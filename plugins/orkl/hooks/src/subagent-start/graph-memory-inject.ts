/**
 * Graph Memory Inject - SubagentStart Hook
 * CC 2.1.7 Compliant: outputs JSON with continue field
 *
 * Injects graph-based memory context before agent spawn.
 * Always runs - knowledge graph requires no configuration.
 *
 * Part of OrchestKit memory system.
 *
 * Version: 1.0.0 (split from agent-memory-inject.ts)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Agent type to domain mapping
const AGENT_DOMAINS: Record<string, string> = {
  'database-engineer': 'database schema SQL PostgreSQL migration pgvector',
  'backend-system-architect': 'API REST architecture backend FastAPI microservice',
  'frontend-ui-developer': 'React frontend UI component TypeScript Tailwind',
  'security-auditor': 'security OWASP vulnerability audit authentication',
  'test-generator': 'testing unit integration coverage pytest MSW',
  'workflow-architect': 'LangGraph workflow agent orchestration state',
  'llm-integrator': 'LLM API OpenAI Anthropic embeddings RAG function-calling',
  'data-pipeline-engineer': 'data pipeline embeddings vector ETL chunking',
  'metrics-architect': 'metrics OKR KPI analytics instrumentation',
  'ux-researcher': 'UX user research persona journey accessibility',
  'code-quality-reviewer': 'code quality review linting type-check patterns',
  'infrastructure-architect': 'infrastructure cloud Docker Kubernetes deployment',
  'ci-cd-engineer': 'CI CD pipeline GitHub Actions deployment automation',
  'accessibility-specialist': 'accessibility WCAG ARIA screen-reader a11y',
  'product-strategist': 'product strategy roadmap features prioritization',
};

function getAgentDomain(agentType: string): string {
  return AGENT_DOMAINS[agentType] || agentType;
}

/** Minimum graph file size in bytes to consider it useful (~3 entities) */
const MIN_GRAPH_SIZE = 100;

/**
 * Graph memory inject - skips when graph is empty/tiny
 */
export function graphMemoryInject(input: HookInput): HookResult {
  logHook('graph-memory-inject', 'Graph memory inject hook starting');

  // Early return: skip if knowledge graph is empty or too small
  const graphDataFile = resolve(getProjectDir(), '.claude/memory/knowledge-graph.jsonl');
  if (!existsSync(graphDataFile)) {
    logHook('graph-memory-inject', 'No graph data file, skipping');
    return outputSilentSuccess();
  }
  try {
    const graphSize = statSync(graphDataFile).size;
    if (graphSize < MIN_GRAPH_SIZE) {
      logHook('graph-memory-inject', `Graph too small (${graphSize}B < ${MIN_GRAPH_SIZE}B), skipping`);
      return outputSilentSuccess();
    }
  } catch {
    logHook('graph-memory-inject', 'Could not stat graph file, skipping');
    return outputSilentSuccess();
  }

  // Extract agent type from hook input
  const toolInput = input.tool_input || {};
  let agentType =
    (toolInput.subagent_type as string) || (toolInput.type as string) || '';

  // Fallback: try to extract from prompt
  if (!agentType && toolInput.prompt) {
    const prompt = (toolInput.prompt as string).toLowerCase();
    const knownAgents = Object.keys(AGENT_DOMAINS);
    for (const agent of knownAgents) {
      if (prompt.includes(agent)) {
        agentType = agent;
        break;
      }
    }
  }

  if (!agentType) {
    logHook('graph-memory-inject', 'No agent type detected, passing through');
    return outputSilentSuccess();
  }

  const agentId = `ork:${agentType}`;
  const domainKeywords = getAgentDomain(agentType);

  logHook('graph-memory-inject', `Detected agent type: ${agentType} (agent_id: ${agentId})`);

  // Build graph memory load instructions
  const memoryLoadMsg = `[Graph Memory - Agent Context Load]

Execute this MCP call to load graph context for ${agentType} agent:

## Graph Memory Entities
\`\`\`
mcp__memory__search_nodes
{"query": "${agentType} ${domainKeywords}"}
\`\`\`

## Integration Instructions
1. Execute the graph search to retrieve relevant entities and relationships
2. Review entities for patterns, decisions, and constraints
3. Check relationships between concepts
4. Apply learned patterns to current task

Agent ID: ${agentId} | Domain: ${domainKeywords}`;

  const systemMsg = `[Graph Memory] Agent: ${agentType} | ID: ${agentId} | Load graph context via MCP call above`;

  logHook('graph-memory-inject', `Outputting graph memory instructions for ${agentType}`);

  return {
    continue: true,
    systemMessage: systemMsg,
    hookSpecificOutput: {
      additionalContext: memoryLoadMsg,
    },
  };
}
