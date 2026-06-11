/**
 * Subagent Validator - SubagentStart Hook (PreToolUse for Task)
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * This is the ONLY place we track subagent usage because:
 * - SubagentStop hook doesn't receive subagent_type (Claude Code limitation)
 * - PreToolUse receives full task details including type, description, prompt
 *
 * Version: 1.0.0 (TypeScript port)
 */

import { existsSync, readFileSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { join, dirname } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWithContext, getProjectDir } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const BUILTIN_TYPES = new Set([
  'general-purpose',
  'Explore',
  'Plan',
  'claude-code-guide',
  'statusline-setup',
  'Bash',
]);

// -----------------------------------------------------------------------------
// Path Helpers (cross-platform using path.join)
// -----------------------------------------------------------------------------

function getTrackingLog(): string {
  return join(getProjectDir(), '.claude', 'logs', 'subagent-spawns.jsonl');
}

function getPluginJson(): string {
  return join(getProjectDir(), 'plugin.json');
}

function getAgentsDir(): string {
  return join(getProjectDir(), 'agents');
}

function getClaudeAgentsDir(): string {
  return join(getProjectDir(), '.claude', 'agents');
}

function getSkillsDir(): string {
  return join(getProjectDir(), 'skills');
}

// -----------------------------------------------------------------------------
// Validation Functions
// -----------------------------------------------------------------------------

function getValidAgentTypes(): Set<string> {
  const validTypes = new Set(BUILTIN_TYPES);

  // Source 1: Load from plugin.json agents array
  const pluginJson = getPluginJson();
  if (existsSync(pluginJson)) {
    try {
      const plugin = JSON.parse(readFileSync(pluginJson, 'utf8'));
      const agents = plugin.agents || [];
      for (const agent of agents) {
        if (agent.id) {
          validTypes.add(agent.id);
        }
      }
    } catch {
      // Ignore
    }
  }

  // Source 2: Scan agents/ directory
  const agentsDirs = [getAgentsDir(), getClaudeAgentsDir()];
  for (const agentsDir of agentsDirs) {
    if (existsSync(agentsDir)) {
      try {
        const files = readdirSync(agentsDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            validTypes.add(file.replace('.md', ''));
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return validTypes;
}

function extractAgentSkills(agentType: string): string[] {
  const skills: string[] = [];
  const agentFiles = [
    join(getAgentsDir(), `${agentType}.md`),
    join(getClaudeAgentsDir(), `${agentType}.md`),
  ];

  let agentFile: string | null = null;
  for (const file of agentFiles) {
    if (existsSync(file)) {
      agentFile = file;
      break;
    }
  }

  if (!agentFile) {
    return skills;
  }

  try {
    const content = readFileSync(agentFile, 'utf8');
    // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
    const lines = content.replace(/\r\n/g, '\n').split('\n');

    let inFrontmatter = false;
    let inSkills = false;

    for (const line of lines) {
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          break; // End of frontmatter
        }
      }

      if (!inFrontmatter) continue;

      if (/^skills:/.test(line)) {
        inSkills = true;
        continue;
      }

      if (inSkills && /^[a-zA-Z]/.test(line) && !/^\s/.test(line)) {
        inSkills = false;
        continue;
      }

      if (inSkills) {
        const match = line.match(/^\s*-\s*(.+)$/);
        if (match) {
          const skillName = match[1].trim();
          skills.push(skillName);
        }
      }
    }
  } catch {
    // Ignore
  }

  return skills;
}

function validateAgentSkills(agentType: string): string[] {
  const skills = extractAgentSkills(agentType);
  const missingSkills: string[] = [];
  const skillsDir = getSkillsDir();

  for (const skill of skills) {
    const skillPath = join(skillsDir, skill, 'SKILL.md');
    if (!existsSync(skillPath)) {
      missingSkills.push(skill);
    }
  }

  return missingSkills;
}

/**
 * Extract tools list from agent frontmatter YAML (CC 2.1.20)
 */
function extractAgentTools(agentType: string): string[] {
  const tools: string[] = [];
  const agentFiles = [
    join(getAgentsDir(), `${agentType}.md`),
    join(getClaudeAgentsDir(), `${agentType}.md`),
  ];

  let agentFile: string | null = null;
  for (const file of agentFiles) {
    if (existsSync(file)) {
      agentFile = file;
      break;
    }
  }

  if (!agentFile) return tools;

  try {
    const content = readFileSync(agentFile, 'utf8');
    // Normalize CRLF to LF for cross-platform compatibility (Windows uses \r\n)
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    let inFrontmatter = false;
    let inTools = false;

    for (const line of lines) {
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          continue;
        } else {
          break;
        }
      }
      if (!inFrontmatter) continue;

      if (/^tools:/.test(line)) {
        inTools = true;
        continue;
      }
      if (inTools && /^[a-zA-Z]/.test(line) && !/^\s/.test(line)) {
        inTools = false;
        continue;
      }
      if (inTools) {
        const match = line.match(/^\s*-\s*(.+)$/);
        if (match) {
          tools.push(match[1].trim());
        }
      }
    }
  } catch {
    // Ignore
  }

  return tools;
}

/**
 * Generate permission profile markdown for agent (CC 2.1.20)
 */
function getPermissionProfile(agentType: string, tools: string[]): string {
  if (tools.length === 0) return '';

  const readOnly = tools.every(t => ['Read', 'Glob', 'Grep'].includes(t));
  const hasBash = tools.includes('Bash');
  const hasWrite = tools.includes('Write') || tools.includes('Edit');

  let riskLevel = 'low';
  if (hasBash && hasWrite) riskLevel = 'elevated';
  else if (hasBash || hasWrite) riskLevel = 'moderate';

  return `## Agent Permission Profile (CC 2.1.20)

**Agent**: \`${agentType}\`
**Tools**: ${tools.join(', ')}
**Risk Level**: ${riskLevel}${readOnly ? ' (read-only)' : ''}

${hasBash ? '> This agent requests Bash access. Review commands carefully.\n' : ''}`;
}

// Rotation threshold for the spawn log. 500KB ≈ ~4,000 entries — well
// above any single session's churn, comfortably below the 850KB+ growth
// observed in #1956 (7,213 accumulated entries before first rotation).
// Matches the order-of-magnitude of the hooks.log rotation in lib/log.ts.
const SPAWN_LOG_ROTATE_BYTES = 500 * 1024;

/**
 * Resolve the 1-based nesting depth of a spawn (CC 2.1.172: chains up to 5 levels).
 * No parent → depth 1 (main loop). Otherwise look the parent up in the spawn log
 * (bounded — rotated at 500KB) and add 1. Parent missing from the log (rotated
 * away, or written pre-upgrade without lineage) → conservative depth 2.
 */
function computeSpawnDepth(trackingLog: string, parentAgentId: string | undefined): number {
  if (!parentAgentId) return 1;
  try {
    if (existsSync(trackingLog)) {
      const lines = readFileSync(trackingLog, 'utf8').trimEnd().split('\n');
      // Walk backwards — the most recent entry for the parent wins.
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]) as { agent_id?: string; spawn_depth?: number };
          if (entry.agent_id && entry.agent_id === parentAgentId) {
            return (typeof entry.spawn_depth === 'number' ? entry.spawn_depth : 1) + 1;
          }
        } catch {
          // Skip malformed line.
        }
      }
    }
  } catch {
    // Best-effort — never block a dispatch on telemetry.
  }
  return 2;
}

/**
 * Returns the computed spawn depth when lineage is resolvable, else null.
 *
 * HONESTY NOTE (#2371 finding 3, live-verified 2026-06-11): CC ≤ 2.1.173
 * sends NO `parent_agent_id` at SubagentStart, so nested spawns are
 * indistinguishable from top-level ones here. We therefore OMIT
 * `spawn_depth` rather than fabricate `1` for every entry (which made
 * nested spawns under-count and kept the depth ≥ 4 warning permanently
 * dormant). The lineage path below lights up automatically if CC ships
 * parent context (upstream: anthropics/claude-code#16424).
 */
function logSpawn(
  subagentType: string,
  description: string,
  sessionId: string,
  agentId?: string,
  parentAgentId?: string,
): number | null {
  const trackingLog = getTrackingLog();
  const dir = dirname(trackingLog);

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Ignore
  }

  // Rotate the spawn log when it grows past the threshold. Best-effort,
  // swallow all errors — this hook is informational and must never block
  // an Agent dispatch. See #1956.
  try {
    if (existsSync(trackingLog) && statSync(trackingLog).size > SPAWN_LOG_ROTATE_BYTES) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      renameSync(trackingLog, `${trackingLog}.old.${ts}`);
    }
  } catch {
    // Ignore — rotation is opportunistic.
  }

  const spawnDepth = parentAgentId ? computeSpawnDepth(trackingLog, parentAgentId) : null;

  const entry = {
    timestamp: new Date().toISOString(),
    source: 'start' as const,
    subagent_type: subagentType,
    description: description,
    session_id: sessionId,
    ...(agentId ? { agent_id: agentId } : {}),
    ...(parentAgentId ? { parent_agent_id: parentAgentId } : {}),
    ...(spawnDepth !== null ? { spawn_depth: spawnDepth } : {}),
  };

  try {
    bufferWrite(trackingLog, `${JSON.stringify(entry)}\n`);
  } catch {
    // Ignore
  }

  return spawnDepth;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentValidator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  // SubagentStart payload carries NO description/prompt (live-captured on
  // CC 2.1.173: only session_id/transcript_path/cwd/agent_id/agent_type/
  // hook_event_name). Task summaries are logged by pretool/task/
  // spawn-intent-logger instead; this stays for forward-compat if CC adds it.
  const description = (toolInput.description as string) || '';
  const sessionId = input.session_id; // CC 2.1.9+ guarantees session_id

  ctx.log('subagent-validator', `Task invocation: ${subagentType} - ${description}`);

  // Log spawn to tracking file. Nesting lineage is currently DORMANT: CC
  // ≤ 2.1.173 sends no parent_agent_id at SubagentStart, so spawn_depth is
  // omitted and the depth warning below never fires today. The lineage path
  // lights up automatically if CC ships parent context (anthropics/claude-code#16424).
  const spawnDepth = logSpawn(subagentType, description, sessionId, input.agent_id, input.parent_agent_id);
  if (spawnDepth !== null && spawnDepth >= 4) {
    ctx.log('subagent-validator', `WARNING: spawn depth ${spawnDepth} approaching CC's 5-level nesting limit`);
    console.error(
      `Warning: agent chain depth ${spawnDepth}/5 — CC caps nested sub-agents at 5 levels (2.1.172). Consider flattening to parallel dispatch.`,
    );
  }

  // Extract agent type (strip namespace prefix like "ork:")
  const agentTypeOnly = subagentType.replace(/^[^:]+:/, '');

  // Get valid types from multiple sources
  const validTypes = getValidAgentTypes();

  // Validate
  if (!validTypes.has(subagentType) && !validTypes.has(agentTypeOnly)) {
    ctx.log('subagent-validator', `WARNING: Unknown subagent type: ${subagentType}`);
  }

  // Log spawn
  ctx.log('subagent-validator', `Spawning ${subagentType} agent: ${description}`);

  // Validate agent skills
  const missingSkills = validateAgentSkills(agentTypeOnly);
  if (missingSkills.length > 0) {
    const missingList = missingSkills.join(', ');
    ctx.log('subagent-validator', `WARNING: Agent '${agentTypeOnly}' references missing skills: ${missingList}`);
    // Output warning to stderr (visible to user but non-blocking)
    console.error(`Warning: Agent '${agentTypeOnly}' references ${missingSkills.length} missing skill(s): ${missingList}`);
  }

  // CC 2.1.20: Extract agent tools and generate permission profile
  const agentTools = extractAgentTools(agentTypeOnly);
  if (agentTools.length > 0) {
    const permissionProfile = getPermissionProfile(agentTypeOnly, agentTools);
    ctx.log('subagent-validator', `Agent '${agentTypeOnly}' tools: ${agentTools.join(', ')}`);
    return outputWithContext(permissionProfile);
  }

  return outputSilentSuccess();
}
