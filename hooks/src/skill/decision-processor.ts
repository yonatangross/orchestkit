/**
 * Unified Decision Processor Hook
 * Consolidates: mem0-decision-saver + decision-entity-extractor
 *
 * Hook: SkillComplete
 *
 * Purpose:
 * 1. Extract decisions from skill output
 * 2. Extract entities (Agent, Technology, Pattern) for graph memory
 * 3. Suggest mem0 storage with enriched metadata
 *
 * CC 2.1.16 Compliant - Enriched metadata for decision-history
 * Version: 2.0.0 - Consolidated from 2 hooks (~520 LOC → ~250 LOC)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getPluginRoot } from '../lib/common.js';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_OUTPUT_LENGTH = 100;
const MAX_TEXT_LENGTH = 10240;

// Decision indicators
const DECISION_INDICATORS = [
  'decided', 'chose', 'selected', 'will use', 'implemented',
  'architecture:', 'pattern:', 'approach:', 'recommendation:',
  'best practice:', 'conclusion:',
];

// Known OrchestKit agents
const KNOWN_AGENTS = [
  'database-engineer', 'backend-system-architect', 'frontend-ui-developer',
  'security-auditor', 'test-generator', 'workflow-architect', 'llm-integrator',
  'data-pipeline-engineer', 'metrics-architect', 'ux-researcher',
  'ci-cd-engineer', 'infrastructure-architect', 'accessibility-specialist',
];

// Known technologies
const KNOWN_TECHNOLOGIES = [
  'postgresql', 'postgres', 'pgvector', 'redis', 'mongodb', 'sqlite',
  'fastapi', 'django', 'flask', 'express', 'nextjs',
  'react', 'vue', 'angular', 'typescript', 'python',
  'jwt', 'oauth', 'passkeys', 'langchain', 'langgraph', 'langfuse',
  'docker', 'kubernetes', 'terraform', 'aws', 'gcp',
  'pytest', 'jest', 'vitest', 'playwright', 'msw',
];

// Known patterns
const KNOWN_PATTERNS = [
  'cursor-pagination', 'repository-pattern', 'service-layer', 'clean-architecture',
  'dependency-injection', 'event-sourcing', 'cqrs', 'saga-pattern',
  'circuit-breaker', 'rate-limiting', 'optimistic-locking',
  'caching', 'cache-aside', 'rag', 'semantic-search',
];

// Best practice patterns (precompiled)
const BEST_PRACTICE_PATTERNS: [string, RegExp][] = [
  ['cursor-pagination', /cursor[- ]?(based)?[- ]?pagination/i],
  ['jwt-validation', /jwt|json web token/i],
  ['dependency-injection', /dependency injection|di pattern|ioc/i],
  ['rate-limiting', /rate[- ]?limit|throttl/i],
  ['circuit-breaker', /circuit[- ]?breaker|resilience/i],
  ['event-sourcing', /event[- ]?sourc/i],
  ['cqrs', /cqrs|command.*query.*separation/i],
  ['idempotency', /idempoten/i],
];

// Importance keywords
const HIGH_IMPORTANCE = ['critical', 'security', 'breaking', 'migration', 'architecture', 'production'];
const MEDIUM_IMPORTANCE = ['refactor', 'optimize', 'improve', 'update', 'enhance', 'fix'];

// =============================================================================
// TYPES
// =============================================================================

interface ExtractedEntities {
  agents: string[];
  technologies: string[];
  patterns: string[];
}

// =============================================================================
// VERSION DETECTION
// =============================================================================

let cachedPluginVersion: string | null = null;

function getCCVersion(): string {
  if (process.env.CLAUDE_CODE_VERSION) return process.env.CLAUDE_CODE_VERSION;
  try {
    const output = execSync('claude --version 2>/dev/null', { encoding: 'utf-8', timeout: 2000 });
    const match = output.match(/(\d+\.\d+\.\d+)/);
    if (match) return match[1];
  } catch { /* ignore */ }
  return '2.1.16';
}

function getPluginVersion(): string {
  if (cachedPluginVersion) return cachedPluginVersion;
  try {
    const pluginRoot = getPluginRoot();
    const path = join(pluginRoot, '.claude-plugin', 'plugin.json');
    if (existsSync(path)) {
      const content = JSON.parse(readFileSync(path, 'utf-8'));
      cachedPluginVersion = (content.version as string) || 'unknown';
      return cachedPluginVersion;
    }
  } catch { /* ignore */ }
  cachedPluginVersion = 'unknown';
  return cachedPluginVersion;
}

// =============================================================================
// ENTITY EXTRACTION
// =============================================================================

function extractEntities(text: string): ExtractedEntities {
  const textLower = text.toLowerCase();
  return {
    agents: [...new Set(KNOWN_AGENTS.filter(a => textLower.includes(a)))],
    technologies: [...new Set(KNOWN_TECHNOLOGIES.filter(t => textLower.includes(t)))],
    patterns: [...new Set(KNOWN_PATTERNS.filter(p => textLower.includes(p)))],
  };
}

function detectRelationType(text: string): string {
  const t = text.toLowerCase();
  if (/recommend|suggests|advises/.test(t)) return 'RECOMMENDS';
  if (/chose|selected|decided/.test(t)) return 'CHOSEN_FOR';
  if (/replace|instead of/.test(t)) return 'REPLACES';
  if (/conflict|incompatible/.test(t)) return 'CONFLICTS_WITH';
  return 'RELATES_TO';
}

// =============================================================================
// DECISION EXTRACTION
// =============================================================================

function hasDecisionContent(output: string): boolean {
  const lower = output.toLowerCase();
  return DECISION_INDICATORS.some(ind => lower.includes(ind));
}

function extractDecisions(output: string): string[] {
  const decisions: string[] = [];
  for (const indicator of DECISION_INDICATORS) {
    const regex = new RegExp(`[^\\n]*${indicator}[^\\n]*`, 'gi');
    const matches = output.match(regex);
    if (matches) {
      for (const match of matches.slice(0, 3)) {
        const cleaned = match.trim().slice(0, 300);
        if (cleaned.length > 30) decisions.push(cleaned);
      }
    }
  }
  return [...new Set(decisions)].slice(0, 5);
}

function detectCategory(text: string): string {
  const t = text.slice(0, MAX_TEXT_LENGTH).toLowerCase();
  if (/pagination|cursor|offset/.test(t)) return 'pagination';
  if (/security|vulnerability|owasp/.test(t)) return 'security';
  if (/database|sql|postgres|schema/.test(t)) return 'database';
  if (/api|endpoint|rest|graphql/.test(t)) return 'api';
  if (/auth|login|jwt|oauth/.test(t)) return 'authentication';
  if (/test|pytest|jest|vitest/.test(t)) return 'testing';
  if (/deploy|ci|cd|docker|kubernetes/.test(t)) return 'deployment';
  if (/monitoring|logging|tracing|metrics/.test(t)) return 'observability';
  if (/react|frontend|ui|tailwind/.test(t)) return 'frontend';
  if (/llm|rag|embedding|langchain/.test(t)) return 'ai-ml';
  if (/architecture|design|pattern/.test(t)) return 'architecture';
  return 'decision';
}

function detectImportance(text: string): 'high' | 'medium' | 'low' {
  const t = text.toLowerCase();
  if (HIGH_IMPORTANCE.some(k => t.includes(k))) return 'high';
  if (MEDIUM_IMPORTANCE.some(k => t.includes(k))) return 'medium';
  return 'low';
}

function extractBestPractice(text: string): string | null {
  for (const [name, pattern] of BEST_PRACTICE_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function decisionProcessor(input: HookInput): HookResult {
  const skillName = (input as any).skill_name || input.tool_input?.skill || '';
  const skillOutput = (input as any).tool_result || (input as any).output || '';

  if (!skillOutput || skillOutput.length < MIN_OUTPUT_LENGTH) {
    return outputSilentSuccess();
  }

  if (!hasDecisionContent(skillOutput)) {
    return outputSilentSuccess();
  }

  // Extract decisions and entities
  const decisions = extractDecisions(skillOutput);
  const entities = extractEntities(skillOutput);
  const totalEntities = entities.agents.length + entities.technologies.length + entities.patterns.length;

  if (decisions.length === 0 && totalEntities === 0) {
    return outputSilentSuccess();
  }

  // Build output message
  const parts: string[] = [];
  const firstDecision = decisions[0] || skillOutput.slice(0, 200);
  const category = detectCategory(firstDecision);

  // Decision extraction section
  if (decisions.length > 0) {
    const importance = detectImportance(firstDecision);
    const bestPractice = extractBestPractice(firstDecision);
    const ccVersion = getCCVersion();
    const pluginVersion = getPluginVersion();

    const metadata: Record<string, unknown> = {
      category,
      source: 'orchestkit-plugin',
      skill: skillName || 'unknown',
      cc_version: ccVersion,
      plugin_version: pluginVersion,
      importance,
      timestamp: new Date().toISOString(),
    };
    if (bestPractice) metadata.best_practice = bestPractice;

    const pluginRoot = getPluginRoot();
    const scriptPath = `${pluginRoot}/skills/mem0-memory/scripts/crud/add-memory.py`;

    parts.push(`[Decisions] Found ${decisions.length} decisions (category: ${category}, importance: ${importance})

To persist to mem0:
bash ${scriptPath} --text "<decision>" --user-id "orchestkit:all-agents" --metadata '${JSON.stringify(metadata)}' --enable-graph

Example: "${firstDecision.slice(0, 100)}..."`);
  }

  // Entity extraction section
  if (totalEntities > 0) {
    const relationType = detectRelationType(skillOutput);
    const entityList = [
      ...entities.agents.map(a => ({ name: a, entityType: 'Agent', observations: [`Agent: ${a}`] })),
      ...entities.technologies.map(t => ({ name: t, entityType: 'Technology', observations: [`Tech: ${t}`] })),
      ...entities.patterns.map(p => ({ name: p, entityType: 'Pattern', observations: [`Pattern: ${p}`] })),
    ];

    parts.push(`[Entities] Found ${totalEntities} entities for graph memory:
- Agents: ${entities.agents.length}
- Technologies: ${entities.technologies.length}
- Patterns: ${entities.patterns.length}

mcp__memory__create_entities with:
entities: ${JSON.stringify(entityList.slice(0, 5))}

Relation type: ${relationType}`);
  }

  return {
    continue: true,
    systemMessage: parts.join('\n\n'),
  };
}
