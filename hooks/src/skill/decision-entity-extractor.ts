/**
 * Decision Entity Extractor Hook
 * Extracts entities (Agent, Technology, Pattern, Constraint) from decisions
 * and suggests graph memory relationships for knowledge graph building
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess } from '../lib/common.js';

// Known OrchestKit agents
const KNOWN_AGENTS = [
  'database-engineer',
  'backend-system-architect',
  'frontend-ui-developer',
  'security-auditor',
  'test-generator',
  'workflow-architect',
  'llm-integrator',
  'data-pipeline-engineer',
  'metrics-architect',
  'ux-researcher',
  'code-quality-reviewer',
  'requirements-translator',
  'prioritization-analyst',
  'rapid-ui-designer',
  'market-intelligence',
  'ci-cd-engineer',
  'infrastructure-architect',
  'accessibility-specialist',
  'deployment-manager',
  'git-operations-engineer',
];

// Known technologies
const KNOWN_TECHNOLOGIES = [
  'postgresql', 'postgres', 'pgvector', 'redis', 'mongodb', 'sqlite',
  'fastapi', 'django', 'flask', 'express', 'nestjs',
  'react', 'vue', 'angular', 'nextjs', 'remix', 'svelte',
  'python', 'typescript', 'javascript', 'rust', 'go',
  'jwt', 'oauth', 'oauth2', 'passkeys', 'webauthn',
  'langchain', 'langgraph', 'openai', 'anthropic', 'ollama', 'langfuse',
  'docker', 'kubernetes', 'terraform', 'aws', 'gcp', 'azure',
  'pytest', 'jest', 'vitest', 'playwright', 'msw',
];

// Known patterns
const KNOWN_PATTERNS = [
  'cursor-pagination', 'cursor-based-pagination', 'keyset-pagination',
  'offset-pagination',
  'repository-pattern', 'service-layer', 'clean-architecture',
  'dependency-injection', 'di-pattern',
  'event-sourcing', 'cqrs', 'saga-pattern',
  'circuit-breaker', 'retry-pattern', 'bulkhead',
  'rate-limiting', 'throttling',
  'optimistic-locking', 'pessimistic-locking',
  'caching', 'cache-aside', 'write-through',
  'rag', 'semantic-search', 'vector-search',
];

const MIN_TEXT_LENGTH = 50;

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

/**
 * Extract entities from text
 */
function extractEntities(text: string): {
  agents: string[];
  technologies: string[];
  patterns: string[];
} {
  const textLower = text.toLowerCase();

  const agents = KNOWN_AGENTS.filter((a) => textLower.includes(a));
  const technologies = KNOWN_TECHNOLOGIES.filter((t) => textLower.includes(t));
  const patterns = KNOWN_PATTERNS.filter((p) => textLower.includes(p));

  return {
    agents: [...new Set(agents)],
    technologies: [...new Set(technologies)],
    patterns: [...new Set(patterns)],
  };
}

/**
 * Detect relation type from context
 */
function detectRelationType(text: string): string {
  const textLower = text.toLowerCase();

  if (/recommend|suggests|advises/.test(textLower)) return 'RECOMMENDS';
  if (/chose|selected|decided/.test(textLower)) return 'CHOSEN_FOR';
  if (/replace|instead of|rather than/.test(textLower)) return 'REPLACES';
  if (/conflict|incompatible|anti-pattern/.test(textLower)) return 'CONFLICTS_WITH';

  return 'RELATES_TO';
}

/**
 * Build entity JSON for graph memory
 */
function buildEntities(
  agents: string[],
  technologies: string[],
  patterns: string[]
): Entity[] {
  const entities: Entity[] = [];

  for (const agent of agents) {
    entities.push({
      name: agent,
      entityType: 'Agent',
      observations: [`OrchestKit agent: ${agent}`],
    });
  }

  for (const tech of technologies) {
    entities.push({
      name: tech,
      entityType: 'Technology',
      observations: [`Technology choice: ${tech}`],
    });
  }

  for (const pattern of patterns) {
    entities.push({
      name: pattern,
      entityType: 'Pattern',
      observations: [`Design pattern: ${pattern}`],
    });
  }

  return entities;
}

/**
 * Build relations JSON
 */
function buildRelations(
  agents: string[],
  technologies: string[],
  patterns: string[],
  relationType: string
): Relation[] {
  const relations: Relation[] = [];

  for (const agent of agents) {
    for (const tech of technologies) {
      relations.push({ from: agent, to: tech, relationType });
    }
    for (const pattern of patterns) {
      relations.push({ from: agent, to: pattern, relationType });
    }
  }

  return relations;
}

/**
 * Extract entities from skill output for knowledge graph
 */
export function decisionEntityExtractor(input: HookInput): HookResult {
  // Extract skill info from hook input
  const skillName = (input as any).skill_name || input.tool_input.skill || '';
  const skillOutput = (input as any).tool_result || (input as any).output || '';

  // Skip if no output or too short
  if (!skillOutput || skillOutput.length < MIN_TEXT_LENGTH) {
    return outputSilentSuccess();
  }

  // Extract entities
  const { agents, technologies, patterns } = extractEntities(skillOutput);

  const totalEntities = agents.length + technologies.length + patterns.length;

  // Skip if no entities found
  if (totalEntities === 0) {
    return outputSilentSuccess();
  }

  // Detect relation type
  const relationType = detectRelationType(skillOutput);

  // Build entity and relation JSON
  const entitiesJson = buildEntities(agents, technologies, patterns);
  const relationsJson = buildRelations(agents, technologies, patterns, relationType);

  // Build system message
  const msg = `[Entity Extraction] Found ${totalEntities} entities from ${skillName || 'skill'}:
- Agents: ${agents.length}
- Technologies: ${technologies.length}
- Patterns: ${patterns.length}
- Relations: ${relationsJson.length} (${relationType})

To create knowledge graph, use:

1. mcp__memory__create_entities with:
   entities: ${JSON.stringify(entitiesJson, null, 2)}

2. mcp__memory__create_relations with:
   relations: ${JSON.stringify(relationsJson, null, 2)}

Note: Graph memory is enabled by default (v1.2.0). Entities will be automatically linked when stored via mcp__mem0__add_memory.`;

  return {
    continue: true,
    systemMessage: msg,
  };
}
