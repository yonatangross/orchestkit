/**
 * Model Cost Advisor — SubagentStart Hook
 *
 * Analyzes task complexity and recommends optimal model for cost savings.
 * Reads agent model assignments from frontmatter at runtime (no hardcoded lists).
 * Uses skill `complexity` field and task description keywords for detection.
 *
 * Addresses: Issue #331
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWarning, getPluginRoot } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import modelsVocab from '../lib/models.vocab.json';

// Premium tiers where a downgrade recommendation can apply (#2338). Derived
// behavior must stay backward-identical for opus: tierSavingsPercent
// reproduces the previously hardcoded 40% (low) / 30% (medium) figures.
const PREMIUM_TIERS = new Set(['opus', 'fable']);

// CC 2.1.172 applies `availableModels` to subagent model overrides; 2.1.175
// adds `enforceAvailableModels` (managed) which also constrains Default. An
// agent pinning an excluded tier silently falls back — for capability-pinned
// agents (security-auditor, system-design-reviewer) that's a correctness trap,
// not a cost saving, so it must surface visibly (#2408).
const MANAGED_SETTINGS_PATHS = [
  '/Library/Application Support/ClaudeCode/managed-settings.json',
  '/etc/claude-code/managed-settings.json',
  'C:\\ProgramData\\ClaudeCode\\managed-settings.json',
];

interface AvailableModelsConfig {
  /** Allowlist entries (aliases or full IDs), or null when unrestricted. */
  models: string[] | null;
  /** True when a managed settings file sets enforceAvailableModels. */
  enforced: boolean;
  /** Which settings layer defined the allowlist (for the warning text). */
  source: string;
}

function readJsonSettings(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractModelList(settings: Record<string, unknown>): string[] | null {
  const raw = settings.availableModels;
  if (!Array.isArray(raw)) return null;
  const models = raw.filter((m): m is string => typeof m === 'string');
  return models.length > 0 ? models : null;
}

/**
 * Resolve the effective `availableModels` allowlist, mirroring CC precedence:
 * managed settings win; otherwise the first of user → project-local → project
 * that defines the list. No caching — the hook is one process per invocation.
 */
function getAvailableModelsConfig(): AvailableModelsConfig {
  for (const path of MANAGED_SETTINGS_PATHS) {
    const settings = readJsonSettings(path);
    if (!settings) continue;
    const models = extractModelList(settings);
    if (models) {
      return { models, enforced: settings.enforceAvailableModels === true, source: 'managed settings' };
    }
  }

  const home = process.env.HOME || process.env.USERPROFILE || '';
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '';
  const layers: Array<[string, string]> = [
    [join(home, '.claude', 'settings.json'), 'user settings'],
    [join(projectDir, '.claude', 'settings.local.json'), 'project settings.local'],
    [join(projectDir, '.claude', 'settings.json'), 'project settings'],
  ];
  for (const [path, source] of layers) {
    if (!home && source === 'user settings') continue;
    if (!projectDir && source.startsWith('project')) continue;
    const settings = readJsonSettings(path);
    if (!settings) continue;
    const models = extractModelList(settings);
    if (models) return { models, enforced: false, source };
  }

  return { models: null, enforced: false, source: 'none' };
}

/**
 * Whether a short-name tier (opus/sonnet/haiku/fable) survives the allowlist.
 * Entries may be bare aliases, vocab full IDs, version-specific IDs, or carry
 * a [1m] suffix (normalized away — CC 2.1.173 strips it for Fable anyway).
 */
function isTierAvailable(tier: string, models: string[] | null): boolean {
  if (!models) return true;
  const aliases = modelsVocab.aliases as Record<string, string>;
  const fullId = (aliases[tier] || '').toLowerCase();
  const want = tier.toLowerCase();
  return models.some((entry) => {
    const e = entry.toLowerCase().replace(/\[1m\]$/, '').trim();
    return e === want || (fullId !== '' && e === fullId) || e.startsWith(`claude-${want}-`);
  });
}

/**
 * Coerce a model string (short alias, full ID, or `[1m]` variant) to a short
 * tier (opus/sonnet/haiku/fable). Unknown strings pass through unchanged so
 * downstream PREMIUM_TIERS checks simply don't fire.
 */
function toShortTier(model: string): string {
  const m = model.toLowerCase().replace(/\[1m\]$/, '').trim();
  const aliases = modelsVocab.aliases as Record<string, string>;
  for (const sn of modelsVocab.shortNames) {
    if (sn === 'inherit') continue;
    if (m === sn) return sn;
    if (m === (aliases[sn] || '').toLowerCase()) return sn;
    if (m.startsWith(`claude-${sn}-`)) return sn;
  }
  return model;
}

/**
 * CC's hook-readable default model (`model` field, managed → user → project),
 * the effective model an `inherit` agent runs when the session hasn't picked
 * one explicitly. Mirrors the precedence of getAvailableModelsConfig.
 *
 * NOTE (#2706): CC 2.1.196 added an org-console "Org default" model, but that
 * is resolved SERVER-SIDE and is not exposed to hooks (no HookInput field, not
 * written to any local settings file). The local `model` setting below is the
 * closest hook-readable proxy; when only an org default is set, this returns
 * null and we fall back to CLAUDE_MODEL / 'sonnet' — advice stays best-effort.
 */
function getConfiguredDefaultModel(): string | null {
  for (const path of MANAGED_SETTINGS_PATHS) {
    const settings = readJsonSettings(path);
    if (settings && typeof settings.model === 'string') return settings.model;
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '';
  const layers = [
    home ? join(home, '.claude', 'settings.json') : '',
    projectDir ? join(projectDir, '.claude', 'settings.local.json') : '',
    projectDir ? join(projectDir, '.claude', 'settings.json') : '',
  ];
  for (const path of layers) {
    if (!path) continue;
    const settings = readJsonSettings(path);
    if (settings && typeof settings.model === 'string') return settings.model;
  }
  return null;
}

/** % output-price saving moving short-name tier `from` to `to` (vocab pricing). */
function tierSavingsPercent(from: string, to: string): number {
  const aliases = modelsVocab.aliases as Record<string, string>;
  const pricing = modelsVocab.pricing as Record<string, { output_per_mtok: number }>;
  const f = pricing[aliases[from]]?.output_per_mtok;
  const t = pricing[aliases[to]]?.output_per_mtok;
  if (!f || !t || t >= f) return 0;
  return Math.round((1 - t / f) * 100);
}

// Keyword signals for complexity detection (fallback when frontmatter unavailable)
const HIGH_COMPLEXITY_SIGNALS = [
  /security|vulnerab|audit|penetration/i,
  /architect|design.*system|distributed/i,
  /migration.*schema|database.*design/i,
  /performance.*optim|profil|bottleneck/i,
  /langgraph|workflow.*orchestrat/i,
];

const LOW_COMPLEXITY_SIGNALS = [
  /\b(?:list|count|check|verify|read|search)\b/i,
  /\b(?:simple|straightforward|quick)\b/i,
  /\b(?:format|lint|style|typo|rename)\b/i,
  /\b(?:status|progress|summary)\b/i,
];

interface ModelAdvice {
  recommended: string;
  current: string;
  reason: string;
  savingsPercent: number;
}

/** Cache agent frontmatter reads for the duration of this process */
const agentModelCache = new Map<string, string>();
const agentComplexityCache = new Map<string, 'low' | 'medium' | 'high' | null>();

/**
 * Read the model field from an agent's frontmatter.
 * Returns 'opus', 'sonnet', 'haiku', or 'inherit'.
 */
function getAgentModel(agentType: string): string {
  if (agentModelCache.has(agentType)) {
    return agentModelCache.get(agentType)!;
  }

  const pluginRoot = getPluginRoot();
  if (!pluginRoot) {
    agentModelCache.set(agentType, 'inherit');
    return 'inherit';
  }

  const agentFile = join(pluginRoot, 'agents', `${agentType}.md`);
  if (!existsSync(agentFile)) {
    agentModelCache.set(agentType, 'inherit');
    return 'inherit';
  }

  try {
    const content = readFileSync(agentFile, 'utf8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      agentModelCache.set(agentType, 'inherit');
      return 'inherit';
    }

    const modelMatch = fmMatch[1].match(/^model:\s*(.+)$/m);
    const model = modelMatch ? modelMatch[1].trim() : 'inherit';
    agentModelCache.set(agentType, model);
    return model;
  } catch {
    agentModelCache.set(agentType, 'inherit');
    return 'inherit';
  }
}

/**
 * Read complexity from agent's skill frontmatter fields.
 * Returns the highest complexity among the agent's skills.
 */
function getAgentSkillComplexity(agentType: string): 'low' | 'medium' | 'high' | null {
  if (agentComplexityCache.has(agentType)) {
    return agentComplexityCache.get(agentType)!;
  }

  const pluginRoot = getPluginRoot();
  if (!pluginRoot) {
    agentComplexityCache.set(agentType, null);
    return null;
  }

  const agentFile = join(pluginRoot, 'agents', `${agentType}.md`);
  if (!existsSync(agentFile)) {
    agentComplexityCache.set(agentType, null);
    return null;
  }

  try {
    const content = readFileSync(agentFile, 'utf8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      agentComplexityCache.set(agentType, null);
      return null;
    }

    const skillsMatch = fmMatch[1].match(/^skills:\s*\n((?:\s+-\s+.+\n)*)/m);
    if (!skillsMatch) {
      agentComplexityCache.set(agentType, null);
      return null;
    }

    const skills = skillsMatch[1].match(/^\s+-\s+(.+)$/gm)?.map(s => s.trim().replace(/^-\s+/, '')) || [];
    if (skills.length === 0) {
      agentComplexityCache.set(agentType, null);
      return null;
    }

    const complexityOrder = { low: 0, medium: 1, high: 2 };
    let maxComplexity: 'low' | 'medium' | 'high' = 'low';

    // Sample up to 5 skills for performance
    for (const skill of skills.slice(0, 5)) {
      const skillFile = join(pluginRoot, 'skills', skill, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const skillContent = readFileSync(skillFile, 'utf8');
      const skillFm = skillContent.match(/^---\n([\s\S]*?)\n---/);
      if (!skillFm) continue;

      const cMatch = skillFm[1].match(/^complexity:\s*(low|medium|high)$/m);
      if (cMatch) {
        const c = cMatch[1] as 'low' | 'medium' | 'high';
        if (complexityOrder[c] > complexityOrder[maxComplexity]) {
          maxComplexity = c;
        }
      }
    }

    agentComplexityCache.set(agentType, maxComplexity);
    return maxComplexity;
  } catch {
    agentComplexityCache.set(agentType, null);
    return null;
  }
}

/**
 * Detect task complexity from description, agent type, and skill frontmatter.
 * Priority: skill frontmatter > keyword heuristics > default medium.
 */
function analyzeComplexity(agentType: string, description: string): 'low' | 'medium' | 'high' {
  const skillComplexity = getAgentSkillComplexity(agentType);
  if (skillComplexity === 'high') return 'high';

  const highMatches = HIGH_COMPLEXITY_SIGNALS.filter(p => p.test(description)).length;
  const agentModel = getAgentModel(agentType);
  if (highMatches >= 2 || PREMIUM_TIERS.has(agentModel)) return 'high';

  const lowMatches = LOW_COMPLEXITY_SIGNALS.filter(p => p.test(description)).length;
  if (lowMatches >= 2) return 'low';

  if (skillComplexity) return skillComplexity;
  return 'medium';
}

/**
 * Resolve the effective model for an agent (handles 'inherit').
 */
function resolveEffectiveModel(agentType: string): string {
  const model = getAgentModel(agentType);
  if (model === 'inherit') {
    // Prefer the hook-readable configured default (settings `model`), then the
    // session env, then the historical 'sonnet' assumption. See #2706.
    const raw = getConfiguredDefaultModel() || process.env.CLAUDE_MODEL || 'sonnet';
    return toShortTier(raw);
  }
  return model;
}

function getModelAdvice(agentType: string, description: string): ModelAdvice | null {
  const complexity = analyzeComplexity(agentType, description);
  const current = resolveEffectiveModel(agentType);

  // High complexity task on cheap model → recommend upgrade
  if (complexity === 'high' && current === 'haiku') {
    return {
      recommended: 'sonnet',
      current,
      reason: 'High-complexity task — haiku may produce lower quality results',
      savingsPercent: 0,
    };
  }

  // Low complexity task on a premium model (opus/fable) → recommend downgrade.
  // Savings derive from vocab pricing: opus → 40%, fable → 70%.
  if (complexity === 'low' && PREMIUM_TIERS.has(current)) {
    return {
      recommended: 'sonnet',
      current,
      reason: 'Simple task — sonnet handles this equally well at lower cost',
      savingsPercent: tierSavingsPercent(current, 'sonnet'),
    };
  }

  // Medium complexity on a premium model (only if the agent doesn't
  // explicitly pin that tier). 10 points more conservative than the low-
  // complexity figure: opus → 30%, fable → 60%.
  if (
    complexity === 'medium' &&
    PREMIUM_TIERS.has(current) &&
    getAgentModel(agentType) !== current
  ) {
    return {
      recommended: 'sonnet',
      current,
      reason: 'Medium-complexity task — sonnet is sufficient',
      savingsPercent: tierSavingsPercent(current, 'sonnet') - 10,
    };
  }

  return null;
}

export function modelCostAdvisor(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolInput = input.tool_input || {};
  const agentType = (toolInput.subagent_type as string) || '';
  const description = (toolInput.description as string) || '';

  if (!agentType) {
    return outputSilentSuccess();
  }

  const complexity = analyzeComplexity(agentType, description);
  const currentModel = resolveEffectiveModel(agentType);

  // #2408: a pinned tier excluded by availableModels is a correctness problem,
  // not a cost one — CC silently substitutes an allowed model, so a security
  // auditor pinned to opus can quietly run on a weaker tier. Warn VISIBLY and
  // skip cost advice (recommendations are meaningless under substitution).
  const availability = getAvailableModelsConfig();
  const pinnedModel = getAgentModel(agentType);
  if (pinnedModel !== 'inherit' && !isTierAvailable(pinnedModel, availability.models)) {
    ctx.log('model-cost-advisor',
      `${agentType}: pinned "${pinnedModel}" excluded by availableModels (${availability.source})`,
      'info'
    );
    return outputWarning(
      `Model availability: ${agentType} pins "${pinnedModel}" but the availableModels allowlist ` +
      `(${availability.source}) excludes that tier — CC silently falls back to an allowed model` +
      `${availability.enforced ? ' (enforceAvailableModels is ON, Default is constrained too)' : ''}. ` +
      `Capability-pinned agents may degrade without error; re-pin to an allowed tier or update the allowlist.`
    );
  }

  let advice = getModelAdvice(agentType, description);

  // Never recommend a model the allowlist excludes.
  if (advice && !isTierAvailable(advice.recommended, availability.models)) {
    ctx.log('model-cost-advisor',
      `${agentType}: suppressing "${advice.recommended}" advice — tier excluded by availableModels (${availability.source})`
    );
    advice = null;
  }

  if (!advice) {
    ctx.log('model-cost-advisor', `${agentType}: ${currentModel} appropriate for ${complexity} task`);
    return outputSilentSuccess();
  }

  ctx.log('model-cost-advisor',
    `${agentType}: Recommend ${advice.recommended} over ${advice.current} (${advice.reason})`,
    'info'
  );

  if (advice.savingsPercent >= 30) {
    return outputWarning(
      `Model cost: ${agentType} using ${advice.current} for ${complexity}-complexity task. ` +
      `${advice.reason}. ~${advice.savingsPercent}% savings with "${advice.recommended}".`
    );
  }

  return outputSilentSuccess();
}
