/**
 * Agent Memory Inject - SubagentStart Hook
 * CC 2.1.7 Compliant: outputs JSON with continue field
 *
 * Injects actionable memory load instructions before agent spawn with cross-agent federation.
 *
 * Strategy:
 * - Query mem0 for agent-specific memories using agent_id scope
 * - Query for project decisions relevant to agent's domain
 * - Query related agents for cross-agent knowledge sharing
 * - Query graph memory for entity relationships
 * - Output actionable MCP call instructions for memory loading
 *
 * Version: 1.3.0 (TypeScript port)
 * Part of Mem0 Pro Integration - Memory Fabric
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir, getSessionId } from '../lib/common.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

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

function isMem0Available(): boolean {
  const { existsSync } = require('node:fs');
  const homeDir = process.env.HOME || '';

  const configPaths = [
    `${homeDir}/.config/claude/claude_desktop_config.json`,
    `${homeDir}/Library/Application Support/Claude/claude_desktop_config.json`,
  ];

  for (const configPath of configPaths) {
    try {
      if (existsSync(configPath)) {
        const { readFileSync } = require('node:fs');
        const content = readFileSync(configPath, 'utf8');
        if (content.includes('mem0')) {
          return true;
        }
      }
    } catch {
      // Ignore
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function agentMemoryInject(input: HookInput): HookResult {
  logHook('agent-memory-inject', 'Agent memory inject hook starting (v1.3.0 - Memory Fabric)');

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
    logHook('agent-memory-inject', 'No agent type detected, passing through');
    return outputSilentSuccess();
  }

  const agentId = `ork:${agentType}`;
  logHook('agent-memory-inject', `Detected agent type: ${agentType} (agent_id: ${agentId})`);

  // Check if mem0 is available
  if (!isMem0Available()) {
    logHook('agent-memory-inject', 'Mem0 not available, skipping memory injection');
    return outputSilentSuccess();
  }

  // Build memory query parameters
  const projectId = getProjectId();
  const agentUserId = mem0UserId(MEM0_SCOPE_AGENTS);
  const decisionsUserId = mem0UserId(MEM0_SCOPE_DECISIONS);
  const globalUserId = mem0GlobalUserId('best-practices');
  const domainKeywords = getAgentDomain(agentType);
  const searchQuery = `${agentType} patterns decisions ${domainKeywords}`;

  logHook('agent-memory-inject', `Memory search: agent_id=${agentId}, project=${projectId}`);

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
  let memoryLoadMsg = `[Memory Fabric - Agent Context Load]

Execute these MCP calls to load context for ${agentType} agent:

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

## 3. Graph Memory Entities
\`\`\`
mcp__memory__search_nodes
{"query": "${agentType} ${domainKeywords}"}
\`\`\`

## 4. Cross-Project Best Practices (mem0)
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

## 5. Cross-Agent Knowledge (from: ${relatedAgentsStr})
\`\`\`
mcp__mem0__search_memories
${crossAgentQuery}
\`\`\``;
  }

  // Add integration instructions
  const relatedStr = relatedAgents.length > 0 ? relatedAgents.join(', ') : 'none';
  memoryLoadMsg += `

## Integration Instructions
1. Execute the above MCP calls to retrieve relevant context
2. Review memories for patterns, decisions, and constraints
3. Check graph entities for relationships between concepts
4. Apply learned patterns to current task
5. Avoid known anti-patterns (outcome: failed)

Agent ID: ${agentId} | Domain: ${domainKeywords} | Related: ${relatedStr}`;

  const systemMsg = `[Memory Fabric] Agent: ${agentType} | ID: ${agentId} | Load context via MCP calls above | Related: ${relatedStr}`;

  logHook('agent-memory-inject', `Outputting memory load instructions for ${agentType} (Memory Fabric v1.3.0)`);

  return {
    continue: true,
    systemMessage: systemMsg,
    hookSpecificOutput: {
      additionalContext: memoryLoadMsg,
    },
  };
}
