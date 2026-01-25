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
  ['api', 'api-design-framework', 80],
  ['endpoint', 'api-design-framework', 70],
  ['rest', 'api-design-framework', 75],
  ['graphql', 'api-design-framework', 75],
  ['route', 'api-design-framework', 60],
  ['fastapi', 'fastapi-advanced', 90],
  ['uvicorn', 'fastapi-advanced', 70],
  ['starlette', 'fastapi-advanced', 60],
  ['middleware', 'fastapi-advanced', 50],
  ['pydantic', 'fastapi-advanced', 60],

  // Database
  ['database', 'database-schema-designer', 80],
  ['schema', 'database-schema-designer', 70],
  ['table', 'database-schema-designer', 50],
  ['migration', 'alembic-migrations', 85],
  ['alembic', 'alembic-migrations', 95],
  ['sql', 'database-schema-designer', 60],
  ['postgres', 'database-schema-designer', 70],
  ['query', 'database-schema-designer', 40],
  ['index', 'database-schema-designer', 50],
  ['sqlalchemy', 'sqlalchemy-2-async', 85],
  ['async.*database', 'sqlalchemy-2-async', 80],
  ['orm', 'sqlalchemy-2-async', 60],
  ['connection.*pool', 'connection-pooling', 90],
  ['pool', 'connection-pooling', 60],
  ['pgvector', 'pgvector-search', 95],
  ['vector.*search', 'pgvector-search', 85],
  ['embedding', 'embeddings', 80],

  // Authentication & Security
  ['auth', 'auth-patterns', 85],
  ['login', 'auth-patterns', 75],
  ['jwt', 'auth-patterns', 80],
  ['oauth', 'auth-patterns', 85],
  ['passkey', 'auth-patterns', 90],
  ['webauthn', 'auth-patterns', 90],
  ['session', 'auth-patterns', 60],
  ['password', 'auth-patterns', 70],
  ['security', 'owasp-top-10', 75],
  ['owasp', 'owasp-top-10', 95],
  ['xss', 'owasp-top-10', 80],
  ['injection', 'owasp-top-10', 80],
  ['csrf', 'owasp-top-10', 80],
  ['validation', 'input-validation', 70],
  ['sanitiz', 'input-validation', 80],
  ['defense.*depth', 'defense-in-depth', 95],

  // Testing
  ['test', 'integration-testing', 60],
  ['unit.*test', 'pytest-advanced', 80],
  ['pytest', 'pytest-advanced', 90],
  ['integration.*test', 'integration-testing', 85],
  ['e2e', 'e2e-testing', 90],
  ['playwright', 'e2e-testing', 80],
  ['mock', 'msw-mocking', 75],
  ['msw', 'msw-mocking', 95],
  ['fixture', 'test-data-management', 80],
  ['test.*data', 'test-data-management', 85],
  ['coverage', 'pytest-advanced', 60],
  ['property.*test', 'property-based-testing', 90],
  ['hypothesis', 'property-based-testing', 95],
  ['contract.*test', 'contract-testing', 95],
  ['pact', 'contract-testing', 95],
  ['golden.*dataset', 'golden-dataset-validation', 90],
  ['performance.*test', 'performance-testing', 90],
  ['load.*test', 'performance-testing', 85],
  ['k6', 'performance-testing', 95],
  ['locust', 'performance-testing', 95],

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
  ['radix', 'radix-primitives', 95],
  ['shadcn', 'radix-primitives', 80],
  ['tailwind', 'design-system-starter', 60],
  ['design.*system', 'design-system-starter', 85],
  ['animation', 'motion-animation-patterns', 80],
  ['framer', 'motion-animation-patterns', 90],
  ['core.*web.*vital', 'core-web-vitals', 95],
  ['lcp', 'core-web-vitals', 80],
  ['cls', 'core-web-vitals', 80],
  ['inp', 'core-web-vitals', 80],
  ['i18n', 'i18n-date-patterns', 90],
  ['internationalization', 'i18n-date-patterns', 95],
  ['locale', 'i18n-date-patterns', 70],

  // Accessibility
  ['accessibility', 'a11y-testing', 85],
  ['a11y', 'a11y-testing', 95],
  ['wcag', 'a11y-testing', 95],
  ['screen.*reader', 'focus-management', 80],
  ['keyboard.*nav', 'focus-management', 90],
  ['focus', 'focus-management', 60],
  ['aria', 'focus-management', 70],

  // AI/LLM
  ['llm', 'function-calling', 70],
  ['openai', 'function-calling', 60],
  ['anthropic', 'function-calling', 60],
  ['function.*call', 'function-calling', 90],
  ['tool.*use', 'function-calling', 85],
  ['stream', 'llm-streaming', 70],
  ['rag', 'rag-retrieval', 95],
  ['retrieval', 'rag-retrieval', 75],
  ['context', 'contextual-retrieval', 60],
  ['chunk', 'embeddings', 70],
  ['vector', 'embeddings', 75],
  ['semantic.*search', 'embeddings', 85],
  ['langfuse', 'langfuse-observability', 95],
  ['llm.*observ', 'langfuse-observability', 90],
  ['langgraph', 'langgraph-state', 85],
  ['agent', 'agent-loops', 70],
  ['workflow', 'langgraph-state', 60],
  ['supervisor', 'langgraph-supervisor', 90],
  ['human.*in.*loop', 'langgraph-human-in-loop', 95],
  ['checkpoint', 'langgraph-checkpoints', 90],
  ['prompt.*cache', 'prompt-caching', 95],
  ['cache.*llm', 'semantic-caching', 85],
  ['eval', 'llm-evaluation', 70],
  ['llm.*test', 'llm-testing', 85],
  ['ollama', 'ollama-local', 95],

  // DevOps & Infrastructure
  ['deploy', 'devops-deployment', 75],
  ['ci', 'devops-deployment', 60],
  ['cd', 'devops-deployment', 60],
  ['github.*action', 'github-operations', 85],
  ['release', 'release-management', 80],
  ['changelog', 'release-management', 70],
  ['version', 'release-management', 50],
  ['observ', 'observability-monitoring', 80],
  ['monitor', 'observability-monitoring', 70],
  ['log', 'observability-monitoring', 50],
  ['metric', 'observability-monitoring', 60],
  ['trace', 'observability-monitoring', 70],
  ['alert', 'observability-monitoring', 60],

  // Git & GitHub
  ['git', 'git-workflow', 70],
  ['branch', 'git-workflow', 60],
  ['commit', 'commit', 80],
  ['rebase', 'git-workflow', 70],
  ['stacked.*pr', 'stacked-prs', 95],
  ['pr', 'create-pr', 60],
  ['pull.*request', 'create-pr', 75],
  ['recovery', 'git-recovery-command', 80],
  ['reflog', 'git-recovery-command', 95],
  ['milestone', 'github-operations', 80],
  ['issue', 'github-operations', 50],

  // Event-Driven & Messaging
  ['event.*sourc', 'event-sourcing', 95],
  ['kafka', 'message-queues', 85],
  ['rabbitmq', 'message-queues', 85],
  ['queue', 'message-queues', 75],
  ['pub.*sub', 'message-queues', 80],
  ['outbox', 'outbox-pattern', 95],
  ['saga', 'event-sourcing', 70],
  ['cqrs', 'event-sourcing', 80],

  // Async & Concurrency
  ['async', 'asyncio-advanced', 70],
  ['asyncio', 'asyncio-advanced', 90],
  ['taskgroup', 'asyncio-advanced', 95],
  ['concurrent', 'asyncio-advanced', 60],
  ['background.*job', 'background-jobs', 90],
  ['celery', 'background-jobs', 95],
  ['worker', 'background-jobs', 60],
  ['distributed.*lock', 'distributed-locks', 95],
  ['redis.*lock', 'distributed-locks', 85],
  ['idempoten', 'idempotency-patterns', 95],

  // Architecture & Patterns
  ['clean.*architecture', 'clean-architecture', 95],
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
  ['error.*handl', 'error-handling-rfc9457', 85],
  ['rfc.*9457', 'error-handling-rfc9457', 95],
  ['problem.*detail', 'error-handling-rfc9457', 90],
];

interface SkillMatch {
  skill: string;
  confidence: number;
}

/**
 * Find matching skills based on prompt keywords
 */
function findMatchingSkills(prompt: string): SkillMatch[] {
  const promptLower = prompt.toLowerCase();
  const skillScores = new Map<string, number>();

  for (const [keyword, skill, confidence] of KEYWORD_MAPPINGS) {
    // Convert keyword to regex pattern
    const regex = new RegExp(keyword, 'i');

    if (regex.test(promptLower)) {
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

/**
 * Get skill description from SKILL.md frontmatter
 */
function getSkillDescription(skillName: string, skillsDir: string): string {
  const skillFile = join(skillsDir, skillName, 'SKILL.md');

  if (!existsSync(skillFile)) {
    return '';
  }

  try {
    const content = readFileSync(skillFile, 'utf8');

    // Extract description from YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);
      if (descriptionMatch) {
        return descriptionMatch[1].trim();
      }
    }
  } catch {
    // Ignore
  }

  return '';
}

/**
 * Build suggestion message for Claude
 */
function buildSuggestionMessage(matches: SkillMatch[], skillsDir: string): string {
  if (matches.length === 0) {
    return '';
  }

  let message = `## Relevant Skills Detected

Based on your prompt, the following skills may be helpful:

`;

  for (const { skill, confidence } of matches) {
    if (confidence >= MIN_CONFIDENCE) {
      const description = getSkillDescription(skill, skillsDir);
      if (description) {
        message += `- **${skill}** (${confidence}% match): ${description}\n`;
      } else {
        message += `- **${skill}** (${confidence}% match)\n`;
      }
    }
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
