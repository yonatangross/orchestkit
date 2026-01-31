/**
 * Mem0 Memory Inject - SubagentStart Hook
 * CC 2.1.7 Compliant: outputs JSON with continue field
 *
 * Injects mem0 cloud memory context before agent spawn.
 * Only runs when MEM0_API_KEY is configured.
 * Includes cross-agent federation for knowledge sharing.
 *
 * Part of ork-memory-mem0 plugin.
 *
 * Version: 1.0.0 (split from agent-memory-inject.ts)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';

// Configuration
const MAX_MEMORIES = 5;
const MEM0_SCOPE_AGENTS = 'agents';
const MEM0_SCOPE_DECISIONS = 'decisions';

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

// Related agents for cross-agent knowledge sharing
const RELATED_AGENTS: Record<string, string[]> = {
  'database-engineer': ['backend-system-architect', 'security-auditor', 'data-pipeline-engineer'],
  'backend-system-architect': ['database-engineer', 'frontend-ui-developer', 'security-auditor', 'llm-integrator'],
  'frontend-ui-developer': ['backend-system-architect', 'ux-researcher', 'accessibility-specialist', 'rapid-ui-designer'],
  'security-auditor': ['backend-system-architect', 'database-engineer', 'infrastructure-architect'],
  'test-generator': ['backend-system-architect', 'frontend-ui-developer', 'code-quality-reviewer'],
  'workflow-architect': ['llm-integrator', 'backend-system-architect', 'data-pipeline-engineer'],
  'llm-integrator': ['workflow-architect', 'data-pipeline-engineer', 'backend-system-architect'],
  'data-pipeline-engineer': ['database-engineer', 'llm-integrator', 'workflow-architect'],
};

function getAgentDomain(agentType: string): string {
  return AGENT_DOMAINS[agentType] || agentType;
}

function getRelatedAgents(agentType: string): string[] {
  return RELATED_AGENTS[agentType] || [];
}

function getProjectId(): string {
  const projectDir = getProjectDir();
  const projectName = projectDir.split('/').pop() || 'default-project';
  return projectName
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function mem0UserId(scope: string): string {
  return `${getProjectId()}-${scope}`;
}

function mem0GlobalUserId(scope: string): string {
  return `orchestkit-global-${scope}`;
}

/**
 * Mem0 memory inject - only runs when MEM0_API_KEY is configured
 */
export function mem0MemoryInject(input: HookInput): HookResult {
  logHook('mem0-memory-inject', 'Mem0 memory inject hook starting');

  // Gate: Skip if mem0 is not configured
  if (!process.env.MEM0_API_KEY) {
    logHook('mem0-memory-inject', 'Mem0 not configured (no MEM0_API_KEY), skipping');
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
    logHook('mem0-memory-inject', 'No agent type detected, passing through');
    return outputSilentSuccess();
  }

  const agentId = `ork:${agentType}`;
  const projectId = getProjectId();
  const agentUserId = mem0UserId(MEM0_SCOPE_AGENTS);
  const decisionsUserId = mem0UserId(MEM0_SCOPE_DECISIONS);
  const globalUserId = mem0GlobalUserId('best-practices');
  const domainKeywords = getAgentDomain(agentType);
  const searchQuery = `${agentType} patterns decisions ${domainKeywords}`;

  logHook('mem0-memory-inject', `Detected agent type: ${agentType} (agent_id: ${agentId})`);

  // Get related agents
  const relatedAgents = getRelatedAgents(agentType);

  // Build mem0 search JSONs
  const mem0AgentQuery = JSON.stringify({
    query: searchQuery,
    filters: {
      AND: [{ user_id: agentUserId }, { agent_id: agentId }],
    },
    limit: MAX_MEMORIES,
    enable_graph: true,
  });

  const mem0DecisionsQuery = JSON.stringify({
    query: `${domainKeywords} decisions`,
    filters: {
      AND: [{ user_id: decisionsUserId }],
    },
    limit: MAX_MEMORIES,
    enable_graph: true,
  });

  const mem0GlobalQuery = JSON.stringify({
    query: `${domainKeywords} best practices`,
    filters: {
      AND: [{ user_id: globalUserId }],
    },
    limit: MAX_MEMORIES,
    enable_graph: true,
  });

  // Build memory load instructions
  let memoryLoadMsg = `[Mem0 Cloud - Agent Context Load]

Execute these MCP calls to load mem0 context for ${agentType} agent:

## 1. Agent-Specific Patterns (mem0)
\`\`\`
mcp__mem0__search_memories
${mem0AgentQuery}
\`\`\`

## 2. Project Decisions (mem0)
\`\`\`
mcp__mem0__search_memories
${mem0DecisionsQuery}
\`\`\`

## 3. Cross-Project Best Practices (mem0)
\`\`\`
mcp__mem0__search_memories
${mem0GlobalQuery}
\`\`\``;

  // Add cross-agent section if related agents exist
  if (relatedAgents.length > 0) {
    const relatedAgentsStr = relatedAgents.join(', ');
    const agentFilters = [
      { agent_id: agentId },
      ...relatedAgents.map((a) => ({ agent_id: `ork:${a}` })),
    ];
    const crossAgentQuery = JSON.stringify({
      query: domainKeywords,
      filters: {
        AND: [{ user_id: agentUserId }, { OR: agentFilters }],
      },
      limit: MAX_MEMORIES,
      enable_graph: true,
    });

    memoryLoadMsg += `

## 4. Cross-Agent Knowledge (from: ${relatedAgentsStr})
\`\`\`
mcp__mem0__search_memories
${crossAgentQuery}
\`\`\``;
  }

  const relatedStr = relatedAgents.length > 0 ? relatedAgents.join(', ') : 'none';
  memoryLoadMsg += `

## Integration Instructions
1. Execute the above MCP calls to retrieve mem0 context
2. Review memories for patterns, decisions, and constraints
3. Apply learned patterns to current task
4. Avoid known anti-patterns (outcome: failed)

Agent ID: ${agentId} | Domain: ${domainKeywords} | Related: ${relatedStr}`;

  const systemMsg = `[Mem0 Cloud] Agent: ${agentType} | ID: ${agentId} | Load mem0 context via MCP calls above | Related: ${relatedStr}`;

  logHook('mem0-memory-inject', `Outputting mem0 memory instructions for ${agentType}`);

  return {
    continue: true,
    systemMessage: systemMsg,
    hookSpecificOutput: {
      additionalContext: memoryLoadMsg,
    },
  };
}
