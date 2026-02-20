/**
 * Skill Auto-Suggest - UserPromptSubmit Hook
 * Proactive skill suggestion based on prompt analysis
 * Issue #123: Skill Auto-Suggest Hook
 *
 * Analyzes user prompts for task keywords and suggests relevant skills
 * from the skills/ directory via CC 2.1.9 additionalContext injection.
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for suggestions
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getPluginRoot } from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Maximum number of skills to suggest
const MAX_SUGGESTIONS = 3;

// Minimum confidence score (0-100) to include a skill
const MIN_CONFIDENCE = 30;

// Keyword-to-Skill mapping
// Format: [keyword, skillName, confidenceBoost]
const KEYWORD_MAPPINGS: Array<[string, string, number]> = [
  // API & Backend
  ['api', 'api-design', 80],
  ['endpoint', 'api-design', 70],
  ['rest', 'api-design', 75],
  ['graphql', 'api-design', 75],
  ['route', 'api-design', 60],
  ['fastapi', 'python-backend', 90],
  ['uvicorn', 'python-backend', 70],
  ['starlette', 'python-backend', 60],
  ['middleware', 'python-backend', 50],
  ['pydantic', 'python-backend', 60],

  // Database
  ['database', 'database-patterns', 80],
  ['schema', 'database-patterns', 70],
  ['table', 'database-patterns', 50],
  ['migration', 'database-patterns', 85],
  ['alembic', 'database-patterns', 95],
  ['sql', 'database-patterns', 60],
  ['postgres', 'database-patterns', 70],
  ['query', 'database-patterns', 40],
  ['index', 'database-patterns', 50],
  ['sqlalchemy', 'python-backend', 85],
  ['async.*database', 'python-backend', 80],
  ['orm', 'python-backend', 60],
  ['connection.*pool', 'python-backend', 90],
  ['pool', 'python-backend', 60],
  ['pgvector', 'rag-retrieval', 95],
  ['vector.*search', 'rag-retrieval', 85],
  ['embedding', 'rag-retrieval', 80],

  // Authentication & Security
  ['auth', 'security-patterns', 85],
  ['login', 'security-patterns', 75],
  ['jwt', 'security-patterns', 80],
  ['oauth', 'security-patterns', 85],
  ['passkey', 'security-patterns', 90],
  ['webauthn', 'security-patterns', 90],
  ['session', 'security-patterns', 60],
  ['password', 'security-patterns', 70],
  ['security', 'security-patterns', 75],
  ['owasp', 'security-patterns', 95],
  ['xss', 'security-patterns', 80],
  ['injection', 'security-patterns', 80],
  ['csrf', 'security-patterns', 80],
  ['validation', 'security-patterns', 70],
  ['sanitiz', 'security-patterns', 80],
  ['defense.*depth', 'security-patterns', 95],

  // Testing
  ['test', 'testing-patterns', 60],
  ['unit.*test', 'testing-patterns', 80],
  ['pytest', 'testing-patterns', 90],
  ['integration.*test', 'testing-patterns', 85],
  ['e2e', 'testing-patterns', 90],
  ['playwright', 'testing-patterns', 80],
  ['mock', 'testing-patterns', 75],
  ['msw', 'testing-patterns', 95],
  ['fixture', 'testing-patterns', 80],
  ['test.*data', 'testing-patterns', 85],
  ['coverage', 'testing-patterns', 60],
  ['property.*test', 'testing-patterns', 90],
  ['hypothesis', 'testing-patterns', 95],
  ['contract.*test', 'testing-patterns', 95],
  ['pact', 'testing-patterns', 95],
  ['golden.*dataset', 'golden-dataset', 90],
  ['performance.*test', 'testing-patterns', 90],
  ['load.*test', 'testing-patterns', 85],
  ['k6', 'testing-patterns', 95],
  ['locust', 'testing-patterns', 95],

  // Frontend & React
  ['react', 'react-server-components-framework', 70],
  ['component', 'react-server-components-framework', 50],
  ['server.*component', 'react-server-components-framework', 95],
  ['nextjs', 'react-server-components-framework', 85],
  ['next\\.js', 'react-server-components-framework', 85],
  ['suspense', 'react-server-components-framework', 70],
  ['streaming.*ssr', 'react-server-components-framework', 90],
  ['form', 'form-state-patterns', 70],
  ['react.*hook.*form', 'form-state-patterns', 95],
  ['zod', 'form-state-patterns', 60],
  ['zustand', 'zustand-patterns', 95],
  ['state.*management', 'zustand-patterns', 70],
  ['tanstack', 'tanstack-query-advanced', 90],
  ['react.*query', 'tanstack-query-advanced', 85],
  ['radix', 'ui-components', 95],
  ['shadcn', 'ui-components', 80],
  ['tailwind', 'design-system-starter', 60],
  ['design.*system', 'design-system-starter', 85],
  ['animation', 'frontend-animation', 80],
  ['framer', 'frontend-animation', 90],
  ['core.*web.*vital', 'performance', 95],
  ['lcp', 'performance', 80],
  ['cls', 'performance', 80],
  ['inp', 'performance', 80],
  ['i18n', 'i18n-date-patterns', 90],
  ['internationalization', 'i18n-date-patterns', 95],
  ['locale', 'i18n-date-patterns', 70],

  // Accessibility
  ['accessibility', 'accessibility', 85],
  ['a11y', 'accessibility', 95],
  ['wcag', 'accessibility', 95],
  ['screen.*reader', 'accessibility', 80],
  ['keyboard.*nav', 'accessibility', 90],
  ['focus', 'accessibility', 60],
  ['aria', 'accessibility', 70],

  // AI/LLM
  ['llm', 'llm-integration', 70],
  ['openai', 'llm-integration', 60],
  ['anthropic', 'llm-integration', 60],
  ['function.*call', 'llm-integration', 90],
  ['tool.*use', 'llm-integration', 85],
  ['stream', 'llm-integration', 70],
  ['rag', 'rag-retrieval', 95],
  ['retrieval', 'rag-retrieval', 75],
  ['context.*retrieval', 'rag-retrieval', 85],
  ['chunk', 'rag-retrieval', 70],
  ['vector', 'rag-retrieval', 75],
  ['semantic.*search', 'rag-retrieval', 85],
  ['hyde', 'rag-retrieval', 90],
  ['hypothetical.*document', 'rag-retrieval', 85],
  ['rerank', 'rag-retrieval', 90],
  ['cross.*encoder', 'rag-retrieval', 85],
  ['multimodal.*rag', 'rag-retrieval', 90],
  ['query.*decompos', 'rag-retrieval', 90],
  ['self.*rag', 'rag-retrieval', 95],
  ['corrective.*rag', 'rag-retrieval', 95],
  ['langfuse', 'monitoring-observability', 95],
  ['llm.*observ', 'monitoring-observability', 90],
  ['langgraph', 'langgraph', 85],
  ['agent', 'agent-orchestration', 70],
  ['workflow', 'langgraph', 60],
  ['supervisor', 'langgraph', 90],
  ['human.*in.*loop', 'langgraph', 95],
  ['checkpoint', 'langgraph', 90],
  ['prompt.*cache', 'caching', 95],
  ['cache.*llm', 'caching', 85],
  ['eval', 'llm-evaluation', 70],
  ['llm.*test', 'testing-patterns', 85],
  ['ollama', 'llm-integration', 95],

  // DevOps & Infrastructure
  ['deploy', 'devops-deployment', 75],
  ['ci', 'devops-deployment', 60],
  ['cd', 'devops-deployment', 60],
  ['github.*action', 'github-operations', 85],
  ['release', 'release-management', 80],
  ['changelog', 'release-management', 70],
  ['version', 'release-management', 50],
  ['observ', 'monitoring-observability', 80],
  ['monitor', 'monitoring-observability', 70],
  ['log', 'monitoring-observability', 50],
  ['metric', 'monitoring-observability', 60],
  ['trace', 'monitoring-observability', 70],
  ['alert', 'monitoring-observability', 60],

  // Git & GitHub
  ['git', 'git-workflow', 70],
  ['branch', 'git-workflow', 60],
  ['commit', 'commit', 80],
  ['rebase', 'git-workflow', 70],
  ['stacked.*pr', 'stacked-prs', 95],
  ['pr', 'create-pr', 60],
  ['pull.*request', 'create-pr', 75],
  ['recovery', 'git-recovery', 80],
  ['reflog', 'git-recovery', 95],
  ['milestone', 'github-operations', 80],
  ['issue', 'github-operations', 50],

  // Event-Driven & Messaging
  ['event.*sourc', 'event-driven', 95],
  ['kafka', 'event-driven', 85],
  ['rabbitmq', 'event-driven', 85],
  ['queue', 'event-driven', 75],
  ['pub.*sub', 'event-driven', 80],
  ['outbox', 'event-driven', 95],
  ['saga', 'event-driven', 70],
  ['cqrs', 'event-driven', 80],

  // Async & Concurrency
  ['async', 'python-backend', 70],
  ['asyncio', 'python-backend', 90],
  ['taskgroup', 'python-backend', 95],
  ['concurrent', 'python-backend', 60],
  ['background.*job', 'async-jobs', 90],
  ['celery', 'async-jobs', 95],
  ['worker', 'async-jobs', 60],
  ['distributed.*lock', 'distributed-systems', 95],
  ['redis.*lock', 'distributed-systems', 85],
  ['idempoten', 'distributed-systems', 95],

  // Architecture & Patterns
  ['clean.*architecture', 'architecture-patterns', 95],
  ['ddd', 'domain-driven-design', 95],
  ['domain.*driven', 'domain-driven-design', 90],
  ['aggregate', 'aggregate-patterns', 90],
  ['adr', 'architecture-decision-record', 95],
  ['decision.*record', 'architecture-decision-record', 85],

  // Code Quality
  ['lint', 'biome-linting', 70],
  ['biome', 'biome-linting', 95],
  ['eslint', 'biome-linting', 60],
  ['format', 'biome-linting', 50],
  ['code.*review', 'code-review-playbook', 90],
  ['review', 'code-review-playbook', 60],
  ['quality.*gate', 'quality-gates', 90],

  // Error Handling
  ['error.*handl', 'api-design', 85],
  ['rfc.*9457', 'api-design', 95],
  ['problem.*detail', 'api-design', 90],
];

/**
 * Safe keyword matching without constructing RegExp from untrusted patterns.
 * Keywords containing `.*` are split into parts and matched in order using indexOf.
 * Keywords with `\\.` are matched literally as `.`.
 * Simple keywords use direct substring includes.
 */
function safeKeywordMatch(text: string, keyword: string): boolean {
  // Handle escaped dots: next\.js → next.js (literal match)
  const normalized = keyword.replace(/\\\./g, '.');

  if (normalized.includes('.*')) {
    // Split on .* and check each part appears in order
    const parts = normalized.split('.*');
    let pos = 0;
    for (const part of parts) {
      if (part === '') continue;
      const idx = text.indexOf(part, pos);
      if (idx === -1) return false;
      pos = idx + part.length;
    }
    return true;
  }

  // Simple substring match
  return text.includes(normalized);
}

interface SkillMatch {
  skill: string;
  confidence: number;
}

/**
 * Find matching skills based on prompt keywords.
 * Exported for use by skill-resolver.ts.
 */
export function findMatchingSkills(prompt: string): SkillMatch[] {
  const promptLower = prompt.toLowerCase();
  const skillScores = new Map<string, number>();

  for (const [keyword, skill, confidence] of KEYWORD_MAPPINGS) {
    // Use safe matching: keywords with .* are split on .* and each part checked in order
    // Simple keywords use direct substring match — avoids ReDoS from new RegExp()
    if (safeKeywordMatch(promptLower, keyword)) {
      const currentScore = skillScores.get(skill) || 0;
      if (confidence > currentScore) {
        skillScores.set(skill, confidence);
      }
    }
  }

  // Convert to array and sort by confidence
  const matches: SkillMatch[] = Array.from(skillScores.entries())
    .map(([skill, confidence]) => ({ skill, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_SUGGESTIONS);

  return matches;
}

interface SkillMetadata {
  description: string;
  complexity: 'low' | 'medium' | 'high' | '';
}

/**
 * Get skill metadata (description + complexity) from SKILL.md frontmatter
 */
function getSkillMetadata(skillName: string, skillsDir: string): SkillMetadata {
  const skillFile = join(skillsDir, skillName, 'SKILL.md');

  if (!existsSync(skillFile)) {
    return { description: '', complexity: '' };
  }

  try {
    const content = readFileSync(skillFile, 'utf8');

    // Extract fields from YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
      const complexityMatch = frontmatter.match(/^complexity:\s*(low|medium|high)$/m);
      return {
        description: descriptionMatch ? descriptionMatch[1].trim() : '',
        complexity: (complexityMatch ? complexityMatch[1].trim() : '') as SkillMetadata['complexity'],
      };
    }
  } catch {
    // Ignore
  }

  return { description: '', complexity: '' };
}

// Adaptive thinking guidance based on skill complexity
const COMPLEXITY_HINTS: Record<string, string> = {
  high: 'Use extended thinking for thorough analysis',
  medium: 'Balance depth and speed in your approach',
  low: 'Quick execution — straightforward task',
};

/**
 * Build suggestion message for Claude with complexity-aware thinking hints
 */
function buildSuggestionMessage(matches: SkillMatch[], skillsDir: string): string {
  if (matches.length === 0) {
    return '';
  }

  // Determine highest complexity among matched skills
  let maxComplexity: 'low' | 'medium' | 'high' = 'low';
  const complexityOrder = { low: 0, medium: 1, high: 2 };

  let message = `## Relevant Skills Detected

Based on your prompt, the following skills may be helpful:

`;

  for (const { skill, confidence } of matches) {
    if (confidence >= MIN_CONFIDENCE) {
      const { description, complexity } = getSkillMetadata(skill, skillsDir);
      if (complexity && complexityOrder[complexity] > complexityOrder[maxComplexity]) {
        maxComplexity = complexity;
      }
      const complexityTag = complexity ? ` [${complexity}]` : '';
      if (description) {
        message += `- **${skill}**${complexityTag} (${confidence}% match): ${description}\n`;
      } else {
        message += `- **${skill}**${complexityTag} (${confidence}% match)\n`;
      }
    }
  }

  // Add adaptive thinking hint based on highest complexity
  if (maxComplexity !== 'low') {
    message += `\n**Adaptive thinking:** ${COMPLEXITY_HINTS[maxComplexity]}\n`;
  }

  message += `
Use \`/ork:<skill-name>\` to invoke a user-invocable skill, or read the skill with \`Read skills/<skill-name>/SKILL.md\` for patterns and guidance.`;

  return message;
}

/**
 * Skill auto-suggest hook
 */
export function skillAutoSuggest(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const pluginRoot = getPluginRoot();
  const skillsDir = join(pluginRoot, 'skills');

  if (!prompt) {
    return outputSilentSuccess();
  }

  logHook('skill-auto-suggest', 'Analyzing prompt for skill suggestions...');

  // Find matching skills
  const matches = findMatchingSkills(prompt);

  if (matches.length === 0) {
    logHook('skill-auto-suggest', 'No skill matches found');
    return outputSilentSuccess();
  }

  logHook(
    'skill-auto-suggest',
    `Found matches: ${matches.map((m) => `${m.skill}:${m.confidence}`).join(', ')}`
  );

  // Build suggestion message
  const suggestionMessage = buildSuggestionMessage(matches, skillsDir);

  if (suggestionMessage) {
    logHook('skill-auto-suggest', 'Injecting skill suggestions via additionalContext');
    return outputPromptContext(suggestionMessage);
  }

  return outputSilentSuccess();
}
