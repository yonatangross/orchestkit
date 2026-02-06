/**
 * Skill Usage Optimizer - Track skill usage and suggest consolidation
 * Hook: PostToolUse (Skill)
 * Issue: #127 (CRITICAL)
 *
 * Tracks which skills are used and how often.
 * Stores metrics in .claude/feedback/skill-usage.json
 * Suggests skill consolidation if overlap detected.
 *
 * CC 2.1.9 Compliant: Uses additionalContext for suggestions
 * Version: 1.0.0
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, getField, getProjectDir, getSessionId, logHook } from '../../lib/common.js';

interface SkillUsageFile {
  version: string;
  skills: Record<string, number>;
  sessions: Record<string, string[]>;
  last_updated: string;
}

// Skill overlap definitions for consolidation suggestions
const SKILL_OVERLAPS: Record<string, string> = {
  'api-design-framework|fastapi-advanced': 'Both relate to API design. Consider using api-design-framework for patterns, fastapi-advanced for implementation.',
  'sqlalchemy-2-async|database-schema-designer': 'Both relate to database. Use database-schema-designer for schema design, sqlalchemy-2-async for async patterns.',
  'caching-strategies|performance-optimization': 'Both optimize performance. Consider consolidating caching queries.',
  'auth-patterns|owasp-top-10': 'Both relate to security. auth-patterns for implementation, owasp-top-10 for validation.',
  'asyncio-advanced|connection-pooling': 'Both relate to async. asyncio-advanced for patterns, connection-pooling for specific optimization.',
};

/**
 * Initialize usage file if it doesn't exist
 */
function initUsageFile(usageFile: string): void {
  if (!existsSync(usageFile)) {
    try {
      mkdirSync(require('path').dirname(usageFile), { recursive: true });
      writeFileSync(usageFile, JSON.stringify({
        version: '1.0',
        skills: {},
        sessions: {},
        last_updated: '',
      }));
    } catch {
      // Ignore init errors
    }
  }
}

/**
 * Load usage data
 */
function loadUsageData(usageFile: string): SkillUsageFile {
  initUsageFile(usageFile);

  try {
    return JSON.parse(readFileSync(usageFile, 'utf8'));
  } catch {
    return {
      version: '1.0',
      skills: {},
      sessions: {},
      last_updated: '',
    };
  }
}

/**
 * Update skill usage count
 */
function updateUsage(skill: string, sessionId: string, usageFile: string): void {
  const data = loadUsageData(usageFile);
  const timestamp = new Date().toISOString();

  // Update skill count
  data.skills[skill] = (data.skills[skill] || 0) + 1;

  // Track session usage
  if (!data.sessions[sessionId]) {
    data.sessions[sessionId] = [];
  }
  if (!data.sessions[sessionId].includes(skill)) {
    data.sessions[sessionId].push(skill);
  }

  // Update timestamp
  data.last_updated = timestamp;

  try {
    writeFileSync(usageFile, JSON.stringify(data, null, 2));
    logHook('skill-usage-optimizer', `Updated usage for skill: ${skill} (session: ${sessionId})`);
  } catch {
    // Ignore write errors
  }
}

/**
 * Get session skills for overlap detection
 */
function getSessionSkills(sessionId: string, usageFile: string): string[] {
  const data = loadUsageData(usageFile);
  return data.sessions[sessionId] || [];
}

/**
 * Check for skill overlaps and suggest consolidation
 */
function checkOverlaps(currentSkill: string, sessionSkills: string[]): string | null {
  for (const [overlapKey, suggestion] of Object.entries(SKILL_OVERLAPS)) {
    const [skill1, skill2] = overlapKey.split('|');

    // Check if current skill and any session skill form an overlap
    if (currentSkill === skill1 || currentSkill === skill2) {
      const otherSkill = currentSkill === skill1 ? skill2 : skill1;

      if (sessionSkills.includes(otherSkill)) {
        logHook('skill-usage-optimizer', `Overlap detected: ${skill1} + ${skill2}`);
        return suggestion;
      }
    }
  }

  return null;
}

/**
 * Get top used skills for context
 */
function getUsageStats(usageFile: string): string {
  const data = loadUsageData(usageFile);

  // Get top 3 skills with counts
  const entries = Object.entries(data.skills);
  if (entries.length === 0) return '';

  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill, count]) => `${skill}:${count}`)
    .join(', ');
}

/**
 * Track and optimize skill usage
 */
export function skillUsageOptimizer(input: HookInput): HookResult {
  const toolName = input.tool_name || '';
  const skillName = getField<string>(input, 'tool_input.skill') ||
                   getField<string>(input, 'tool_name') || '';

  // Filter: Only process Skill tool uses
  if (toolName !== 'Skill' && !skillName?.startsWith('skills/')) {
    if (!skillName) {
      return outputSilentSuccess();
    }
  }

  if (!skillName) {
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();
  const usageFile = `${projectDir}/.claude/feedback/skill-usage.json`;
  const sessionId = getSessionId();

  // Update usage
  updateUsage(skillName, sessionId, usageFile);

  // Check for overlaps
  const sessionSkills = getSessionSkills(sessionId, usageFile);
  const overlapSuggestion = checkOverlaps(skillName, sessionSkills);

  // Get usage stats
  const usageStats = getUsageStats(usageFile);

  // Build context message if we have suggestions or stats
  let contextMsg = '';

  if (overlapSuggestion) {
    contextMsg = `Skill overlap: ${overlapSuggestion}`;
    logHook('skill-usage-optimizer', `Suggesting consolidation for: ${skillName}`);
  }

  // Add stats info periodically (every 5th use of any skill)
  const data = loadUsageData(usageFile);
  const currentSkillCount = data.skills[skillName] || 0;

  if (currentSkillCount > 0 && currentSkillCount % 5 === 0 && usageStats) {
    if (contextMsg) {
      contextMsg = `${contextMsg} | Top skills: ${usageStats}`;
    } else {
      contextMsg = `Top skills this project: ${usageStats}`;
    }
  }

  // Output with context if we have something to say
  if (contextMsg) {
    // Truncate if too long
    if (contextMsg.length > 200) {
      contextMsg = contextMsg.substring(0, 197) + '...';
    }

    return {
      continue: true,
      hookSpecificOutput: {
        additionalContext: contextMsg,
      },
    };
  }

  return outputSilentSuccess();
}
