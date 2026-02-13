/**
 * Unified Decision Processor Hook
 * Consolidates: decision-saver + decision-entity-extractor
 *
 * Hook: SkillComplete
 *
 * Purpose:
 * 1. Extract decisions from skill output
 * 2. Extract entities (Agent, Technology, Pattern) for graph memory
 * 3. Suggest graph storage with enriched metadata
 *
 * CC 2.1.16 Compliant - Enriched metadata for memory history
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

/**
 * Enriched decision with rationale extraction
 * Part of Intelligent Decision Capture System
 */
export interface EnrichedDecision {
  /** What was decided/chosen */
  what: string;
  /** Full decision text */
  text: string;
  /** Alternatives that were considered (from "over X" or "instead of Y") */
  alternatives?: string[];
  /** Rationale (from "because", "since", "due to" clauses) */
  rationale?: string;
  /** Constraints mentioned (from "must", "need to", "required") */
  constraints?: string[];
  /** Tradeoffs mentioned (from "tradeoff", "downside", "but") */
  tradeoffs?: string[];
  /** Technologies/patterns mentioned */
  entities: string[];
  /** Confidence score 0-1 */
  confidence: number;
  /** Decision category */
  category: string;
  /** Importance level */
  importance: 'high' | 'medium' | 'low';
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
// RATIONALE EXTRACTION PATTERNS
// =============================================================================

const RATIONALE_PATTERNS: RegExp[] = [
  /\bbecause\s+([^.,!?\n]+)/gi,
  /\bsince\s+([^.,!?\n]+)/gi,
  /\bdue to\s+([^.,!?\n]+)/gi,
  /\bto avoid\s+([^.,!?\n]+)/gi,
  /\bso that\s+([^.,!?\n]+)/gi,
  /\bin order to\s+([^.,!?\n]+)/gi,
  /\bas it\s+([^.,!?\n]+)/gi,
  /\bfor\s+(better|improved|faster|simpler|easier)\s+([^.,!?\n]+)/gi,
];

const ALTERNATIVE_PATTERNS: RegExp[] = [
  /\bover\s+([^.,!?\n]+)/gi,
  /\binstead of\s+([^.,!?\n]+)/gi,
  /\brather than\s+([^.,!?\n]+)/gi,
  /\bnot\s+([^.,!?\n]+)/gi,
  /\bversus\s+([^.,!?\n]+)/gi,
  /\bvs\.?\s+([^.,!?\n]+)/gi,
];

const CONSTRAINT_PATTERNS: RegExp[] = [
  /\b(must|need to|required|constraint|requirement)\s+([^.,!?\n]+)/gi,
  /\b(have to|has to|should)\s+([^.,!?\n]+)/gi,
  /\b(mandatory|essential)\s+([^.,!?\n]+)/gi,
];

const TRADEOFF_PATTERNS: RegExp[] = [
  /\b(tradeoff|trade-off|downside|drawback)\s*:?\s+([^.,!?\n]+)/gi,
  /\bbut\s+([^.,!?\n]+)/gi,
  /\bhowever\s+([^.,!?\n]+)/gi,
  /\balthough\s+([^.,!?\n]+)/gi,
  /\b(cost|limitation)\s+is\s+([^.,!?\n]+)/gi,
];

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

/**
 * Extract rationale from decision text
 */
function extractRationale(text: string): string | undefined {
  for (const pattern of RATIONALE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1]?.trim().slice(0, 200);
    }
  }
  return undefined;
}

/**
 * Extract alternatives mentioned (what was NOT chosen)
 */
function extractAlternatives(text: string): string[] {
  const alternatives: string[] = [];
  for (const pattern of ALTERNATIVE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const alt = match[1]?.trim();
      if (alt && alt.length > 2 && alt.length < 100) {
        alternatives.push(alt);
      }
    }
  }
  return [...new Set(alternatives)].slice(0, 3);
}

/**
 * Extract constraints mentioned
 */
function extractConstraints(text: string): string[] {
  const constraints: string[] = [];
  for (const pattern of CONSTRAINT_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const constraint = match[2]?.trim() || match[1]?.trim();
      if (constraint && constraint.length > 3 && constraint.length < 150) {
        constraints.push(constraint);
      }
    }
  }
  return [...new Set(constraints)].slice(0, 3);
}

/**
 * Extract tradeoffs mentioned
 */
function extractTradeoffs(text: string): string[] {
  const tradeoffs: string[] = [];
  for (const pattern of TRADEOFF_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const tradeoff = match[2]?.trim() || match[1]?.trim();
      if (tradeoff && tradeoff.length > 3 && tradeoff.length < 150) {
        tradeoffs.push(tradeoff);
      }
    }
  }
  return [...new Set(tradeoffs)].slice(0, 3);
}

/**
 * Extract what was chosen from decision text
 */
function extractWhatWasChosen(text: string): string {
  // Look for common decision patterns
  const patterns = [
    /\b(?:chose|decided on|selected|using|will use|going with)\s+([^.,!?\n]+)/i,
    /\b(?:the decision is|decision:)\s+([^.,!?\n]+)/i,
    /\brecommend(?:ation)?:?\s+([^.,!?\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().slice(0, 100);
    }
  }

  // Fall back to first significant phrase
  return text.slice(0, 100).trim();
}

/**
 * Calculate confidence score for an enriched decision
 */
function calculateEnrichedConfidence(decision: EnrichedDecision): number {
  let confidence = 0.5; // Base

  // Having rationale significantly boosts confidence
  if (decision.rationale) confidence += 0.2;

  // Alternatives show explicit comparison
  if (decision.alternatives && decision.alternatives.length > 0) confidence += 0.1;

  // Constraints show thoughtful decision
  if (decision.constraints && decision.constraints.length > 0) confidence += 0.05;

  // Tradeoffs show balanced thinking
  if (decision.tradeoffs && decision.tradeoffs.length > 0) confidence += 0.05;

  // More entities = more specific
  if (decision.entities.length >= 1) confidence += 0.05;
  if (decision.entities.length >= 2) confidence += 0.05;

  // High importance boosts confidence
  if (decision.importance === 'high') confidence += 0.1;

  return Math.min(0.99, confidence);
}

/**
 * Extract enriched decisions with full context
 */
export function extractEnrichedDecisions(output: string): EnrichedDecision[] {
  const rawDecisions = extractDecisions(output);
  const enriched: EnrichedDecision[] = [];

  for (const text of rawDecisions) {
    const entities = extractEntities(text);
    const entityList = [
      ...entities.agents,
      ...entities.technologies,
      ...entities.patterns,
    ];

    const decision: EnrichedDecision = {
      what: extractWhatWasChosen(text),
      text,
      rationale: extractRationale(text),
      alternatives: extractAlternatives(text),
      constraints: extractConstraints(text),
      tradeoffs: extractTradeoffs(text),
      entities: entityList,
      confidence: 0, // Will be calculated
      category: detectCategory(text),
      importance: detectImportance(text),
    };

    decision.confidence = calculateEnrichedConfidence(decision);
    enriched.push(decision);
  }

  return enriched;
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
  const toolResult = input.tool_result;
  const skillOutput = typeof toolResult === 'string'
    ? toolResult
    : (toolResult?.content || (input as any).output || '');

  if (!skillOutput || skillOutput.length < MIN_OUTPUT_LENGTH) {
    return outputSilentSuccess();
  }

  // Truncate to MAX_TEXT_LENGTH to avoid expensive regex on very long output
  const truncatedOutput = skillOutput.length > MAX_TEXT_LENGTH
    ? skillOutput.slice(0, MAX_TEXT_LENGTH)
    : skillOutput;

  if (!hasDecisionContent(truncatedOutput)) {
    return outputSilentSuccess();
  }

  // Extract enriched decisions with rationale
  const enrichedDecisions = extractEnrichedDecisions(truncatedOutput);
  const entities = extractEntities(truncatedOutput);
  const totalEntities = entities.agents.length + entities.technologies.length + entities.patterns.length;

  if (enrichedDecisions.length === 0 && totalEntities === 0) {
    return outputSilentSuccess();
  }

  // Build output message
  const parts: string[] = [];
  const firstDecision = enrichedDecisions[0];
  const category = firstDecision?.category || detectCategory(skillOutput.slice(0, 200));

  // Decision extraction section with enriched data
  if (enrichedDecisions.length > 0) {
    const importance = firstDecision?.importance || 'low';
    const bestPractice = extractBestPractice(firstDecision?.text || '');
    const ccVersion = getCCVersion();
    const pluginVersion = getPluginVersion();

    // Build metadata with enriched information
    const metadata: Record<string, unknown> = {
      category,
      source: 'orchestkit-plugin',
      skill: skillName || 'unknown',
      cc_version: ccVersion,
      plugin_version: pluginVersion,
      importance,
      timestamp: new Date().toISOString(),
      confidence: firstDecision?.confidence || 0.5,
    };

    if (bestPractice) metadata.best_practice = bestPractice;
    if (firstDecision?.rationale) metadata.rationale = firstDecision.rationale;
    if (firstDecision?.alternatives?.length) metadata.alternatives = firstDecision.alternatives;
    if (firstDecision?.constraints?.length) metadata.constraints = firstDecision.constraints;
    if (firstDecision?.tradeoffs?.length) metadata.tradeoffs = firstDecision.tradeoffs;

    // Build detailed decision summary
    let decisionSummary = `[Decisions] Found ${enrichedDecisions.length} decision(s) (category: ${category}, importance: ${importance})`;

    if (firstDecision) {
      decisionSummary += `\n\nPrimary Decision: "${firstDecision.what.slice(0, 100)}"`;
      if (firstDecision.rationale) {
        decisionSummary += `\nRationale: "${firstDecision.rationale.slice(0, 150)}"`;
      }
      if (firstDecision.alternatives?.length) {
        decisionSummary += `\nAlternatives considered: ${firstDecision.alternatives.join(', ')}`;
      }
      if (firstDecision.constraints?.length) {
        decisionSummary += `\nConstraints: ${firstDecision.constraints.join('; ')}`;
      }
      if (firstDecision.tradeoffs?.length) {
        decisionSummary += `\nTradeoffs: ${firstDecision.tradeoffs.join('; ')}`;
      }
      decisionSummary += `\nConfidence: ${(firstDecision.confidence * 100).toFixed(0)}%`;
    }

    decisionSummary += `\n\nTo persist to knowledge graph:
mcp__memory__create_entities with entities: [{"name": "${category}-decision", "entityType": "Decision", "observations": ["<decision>"]}]`;

    parts.push(decisionSummary);

    // Build graph relations for CHOSE_OVER pattern
    if (firstDecision?.alternatives?.length) {
      const relations = firstDecision.alternatives.map(alt => ({
        from: firstDecision.what,
        to: alt,
        relationType: 'CHOSE_OVER',
      }));

      parts.push(`[Relations] Create CHOSE_OVER relations:
mcp__memory__create_relations with:
relations: ${JSON.stringify(relations)}`);
    }
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
