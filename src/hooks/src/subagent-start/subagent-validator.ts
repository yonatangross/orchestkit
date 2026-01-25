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

import { existsSync, readFileSync, mkdirSync, appendFileSync, readdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getSessionId } from '../lib/common.js';

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
// Path Helpers
// -----------------------------------------------------------------------------

function getTrackingLog(): string {
  return `${getProjectDir()}/.claude/logs/subagent-spawns.jsonl`;
}

function getPluginJson(): string {
  return `${getProjectDir()}/plugin.json`;
}

function getAgentsDir(): string {
  return `${getProjectDir()}/agents`;
}

function getClaudeAgentsDir(): string {
  return `${getProjectDir()}/.claude/agents`;
}

function getSkillsDir(): string {
  return `${getProjectDir()}/skills`;
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
    `${getAgentsDir()}/${agentType}.md`,
    `${getClaudeAgentsDir()}/${agentType}.md`,
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
    const lines = content.split('\n');

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
    const skillPath = `${skillsDir}/${skill}/SKILL.md`;
    if (!existsSync(skillPath)) {
      missingSkills.push(skill);
    }
  }

  return missingSkills;
}

function logSpawn(subagentType: string, description: string, sessionId: string): void {
  const trackingLog = getTrackingLog();
  const dir = trackingLog.substring(0, trackingLog.lastIndexOf('/'));

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Ignore
  }

  const entry = {
    timestamp: new Date().toISOString(),
    subagent_type: subagentType,
    description: description,
    session_id: sessionId,
  };

  try {
    appendFileSync(trackingLog, JSON.stringify(entry) + '\n');
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function subagentValidator(input: HookInput): HookResult {
  const toolInput = input.tool_input || {};
  const subagentType = (toolInput.subagent_type as string) || '';
  const description = (toolInput.description as string) || '';
  const sessionId = input.session_id || getSessionId();

  logHook('subagent-validator', `Task invocation: ${subagentType} - ${description}`);

  // Log spawn to tracking file
  logSpawn(subagentType, description, sessionId);

  // Extract agent type (strip namespace prefix like "ork:")
  const agentTypeOnly = subagentType.replace(/^[^:]+:/, '');

  // Get valid types from multiple sources
  const validTypes = getValidAgentTypes();

  // Validate
  if (!validTypes.has(subagentType) && !validTypes.has(agentTypeOnly)) {
    logHook('subagent-validator', `WARNING: Unknown subagent type: ${subagentType}`);
  }

  // Log spawn
  logHook('subagent-validator', `Spawning ${subagentType} agent: ${description}`);

  // Validate agent skills
  const missingSkills = validateAgentSkills(agentTypeOnly);
  if (missingSkills.length > 0) {
    const missingList = missingSkills.join(', ');
    logHook('subagent-validator', `WARNING: Agent '${agentTypeOnly}' references missing skills: ${missingList}`);
    // Output warning to stderr (visible to user but non-blocking)
    console.error(`Warning: Agent '${agentTypeOnly}' references ${missingSkills.length} missing skill(s): ${missingList}`);
  }

  return outputSilentSuccess();
}
