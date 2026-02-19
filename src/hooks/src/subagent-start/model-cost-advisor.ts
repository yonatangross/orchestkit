/**
 * Model Cost Advisor — SubagentStart Hook
 *
 * Analyzes task complexity and recommends optimal model for cost savings.
 * Reads agent model assignments from frontmatter at runtime (no hardcoded lists).
 * Uses skill `complexity` field and task description keywords for detection.
 *
 * Addresses: Issue #331
 */

import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { join, dirname } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWarning, logHook, getProjectDir, getPluginRoot } from '../lib/common.js';

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
  if (highMatches >= 2 || agentModel === 'opus') return 'high';

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
    return process.env.CLAUDE_MODEL || 'sonnet';
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

  // Low complexity task on expensive model → recommend downgrade
  if (complexity === 'low' && current === 'opus') {
    return {
      recommended: 'sonnet',
      current,
      reason: 'Simple task — sonnet handles this equally well at lower cost',
      savingsPercent: 40,
    };
  }

  // Medium complexity on opus (only if agent doesn't explicitly require opus)
  if (complexity === 'medium' && current === 'opus' && getAgentModel(agentType) !== 'opus') {
    return {
      recommended: 'sonnet',
      current,
      reason: 'Medium-complexity task — sonnet is sufficient',
      savingsPercent: 30,
    };
  }

  return null;
}

function logModelUsage(agentType: string, model: string, complexity: string, advice: ModelAdvice | null): void {
  const logFile = join(getProjectDir(), '.claude', 'logs', 'model-usage.jsonl');
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    bufferWrite(logFile, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      agent: agentType,
      model,
      complexity,
      recommendation: advice?.recommended || null,
      potentialSavings: advice?.savingsPercent || 0,
    })}\n`);
  } catch {
    // Non-critical
  }
}

export function modelCostAdvisor(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const agentType = (toolInput.subagent_type as string) || '';
  const description = (toolInput.description as string) || '';

  if (!agentType) {
    return outputSilentSuccess();
  }

  const complexity = analyzeComplexity(agentType, description);
  const currentModel = resolveEffectiveModel(agentType);
  const advice = getModelAdvice(agentType, description);

  logModelUsage(agentType, currentModel, complexity, advice);

  if (!advice) {
    logHook('model-cost-advisor', `${agentType}: ${currentModel} appropriate for ${complexity} task`);
    return outputSilentSuccess();
  }

  logHook('model-cost-advisor',
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
