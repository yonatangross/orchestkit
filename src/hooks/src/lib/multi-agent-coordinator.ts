/**
 * Multi-Agent Coordinator - Pipeline detection and coordination logic
 * Issue #197: Agent Orchestration Layer
 *
 * Provides:
 * - Pipeline definitions for common workflows
 * - Pipeline detection from prompts
 * - Task chain generation with dependencies
 */

import { logHook } from './common.js';
import type {
  PipelineType,
  PipelineDefinition,
  PipelineExecution,
  TaskCreateInstruction,
  TaskMetadata,
} from './orchestration-types.js';
import { registerPipeline, registerTask } from './task-integration.js';

// -----------------------------------------------------------------------------
// Pipeline Definitions
// -----------------------------------------------------------------------------

/**
 * Predefined pipeline configurations
 */
export const PIPELINES: PipelineDefinition[] = [
  {
    type: 'product-thinking',
    name: 'Product Thinking Pipeline',
    description: 'Full product discovery and specification workflow',
    triggers: [
      'should we build',
      'product decision',
      'feature validation',
      'market research',
      'user research',
    ],
    steps: [
      {
        agent: 'market-intelligence',
        description: 'Analyze competitive landscape and market trends',
        dependsOn: [],
        skills: ['market-research'],
        estimatedTokens: 3000,
      },
      {
        agent: 'ux-researcher',
        description: 'Create personas and map user journeys',
        dependsOn: [0],
        skills: ['user-research'],
        estimatedTokens: 2500,
      },
      {
        agent: 'product-strategist',
        description: 'Validate value proposition and alignment',
        dependsOn: [0, 1],
        skills: ['product-strategy'],
        estimatedTokens: 2000,
      },
      {
        agent: 'prioritization-analyst',
        description: 'Score and prioritize using frameworks',
        dependsOn: [2],
        skills: ['prioritization'],
        estimatedTokens: 1500,
      },
      {
        agent: 'business-case-builder',
        description: 'Build ROI and cost-benefit analysis',
        dependsOn: [2, 3],
        skills: ['business-case'],
        estimatedTokens: 2000,
      },
      {
        agent: 'requirements-translator',
        description: 'Transform to PRD and user stories',
        dependsOn: [4],
        skills: ['requirements'],
        estimatedTokens: 2500,
      },
    ],
    estimatedTotalTokens: 13500,
  },
  {
    type: 'full-stack-feature',
    name: 'Full-Stack Feature Pipeline',
    description: 'End-to-end feature implementation workflow',
    triggers: [
      'full-stack feature',
      'build a feature',
      'implement end-to-end',
      'create full feature',
      'add complete feature',
    ],
    steps: [
      {
        agent: 'backend-system-architect',
        description: 'Design API and database schema',
        dependsOn: [],
        skills: ['api-design-framework', 'database-schema-designer'],
        estimatedTokens: 3000,
      },
      {
        agent: 'frontend-ui-developer',
        description: 'Build React components and UI',
        dependsOn: [0],
        skills: ['react-server-components-framework', 'form-state-patterns'],
        estimatedTokens: 3500,
      },
      {
        agent: 'test-generator',
        description: 'Create unit and integration tests',
        dependsOn: [0, 1],
        skills: ['integration-testing', 'msw-mocking'],
        estimatedTokens: 2000,
      },
      {
        agent: 'security-auditor',
        description: 'Audit for vulnerabilities',
        dependsOn: [0, 1],
        skills: ['owasp-top-10', 'auth-patterns'],
        estimatedTokens: 1500,
      },
    ],
    estimatedTotalTokens: 10000,
  },
  {
    type: 'ai-integration',
    name: 'AI Integration Pipeline',
    description: 'Add AI/LLM capabilities to application',
    triggers: [
      'add rag',
      'add llm',
      'ai integration',
      'implement rag',
      'add ai feature',
      'langgraph workflow',
    ],
    steps: [
      {
        agent: 'workflow-architect',
        description: 'Design LangGraph workflow and state',
        dependsOn: [],
        skills: ['langgraph-state', 'langgraph-routing'],
        estimatedTokens: 2500,
      },
      {
        agent: 'llm-integrator',
        description: 'Connect LLM APIs with function calling',
        dependsOn: [0],
        skills: ['function-calling', 'llm-streaming'],
        estimatedTokens: 2000,
      },
      {
        agent: 'data-pipeline-engineer',
        description: 'Build embeddings and data pipeline',
        dependsOn: [0],
        skills: ['embeddings', 'rag-retrieval'],
        estimatedTokens: 2500,
      },
      {
        agent: 'test-generator',
        description: 'Create LLM testing infrastructure',
        dependsOn: [1, 2],
        skills: ['llm-testing', 'property-based-testing'],
        estimatedTokens: 1500,
      },
    ],
    estimatedTotalTokens: 8500,
  },
  {
    type: 'security-audit',
    name: 'Security Audit Pipeline',
    description: 'Comprehensive security review workflow',
    triggers: [
      'security audit',
      'security review',
      'vulnerability scan',
      'security assessment',
    ],
    steps: [
      {
        agent: 'security-auditor',
        description: 'Scan for OWASP Top 10 vulnerabilities',
        dependsOn: [],
        skills: ['owasp-top-10', 'input-validation'],
        estimatedTokens: 2000,
      },
      {
        agent: 'security-layer-auditor',
        description: 'Verify defense-in-depth layers',
        dependsOn: [0],
        skills: ['defense-in-depth'],
        estimatedTokens: 2000,
      },
      {
        agent: 'ai-safety-auditor',
        description: 'Audit AI/LLM security if applicable',
        dependsOn: [0],
        skills: ['mcp-security-hardening'],
        estimatedTokens: 1500,
      },
    ],
    estimatedTotalTokens: 5500,
  },
  {
    type: 'frontend-compliance',
    name: 'Frontend 2026 Compliance Pipeline',
    description: 'Modernize frontend to 2026 patterns',
    triggers: [
      'frontend compliance',
      'modernize frontend',
      'update react',
      'frontend 2026',
    ],
    steps: [
      {
        agent: 'frontend-ui-developer',
        description: 'Upgrade to React 19 patterns',
        dependsOn: [],
        skills: ['react-server-components-framework', 'zustand-patterns'],
        estimatedTokens: 3000,
      },
      {
        agent: 'performance-engineer',
        description: 'Optimize Core Web Vitals',
        dependsOn: [0],
        skills: ['core-web-vitals', 'lazy-loading-patterns'],
        estimatedTokens: 2000,
      },
      {
        agent: 'accessibility-specialist',
        description: 'Ensure WCAG 2.2 compliance',
        dependsOn: [0],
        skills: ['a11y-testing', 'focus-management'],
        estimatedTokens: 1500,
      },
    ],
    estimatedTotalTokens: 6500,
  },
];

// -----------------------------------------------------------------------------
// Pipeline Detection
// -----------------------------------------------------------------------------

/**
 * Detect if prompt matches a pipeline trigger
 */
export function detectPipeline(prompt: string): PipelineDefinition | null {
  const promptLower = prompt.toLowerCase();

  for (const pipeline of PIPELINES) {
    for (const trigger of pipeline.triggers) {
      if (promptLower.includes(trigger)) {
        logHook(
          'multi-agent-coordinator',
          `Detected pipeline: ${pipeline.type} (trigger: "${trigger}")`
        );
        return pipeline;
      }
    }
  }

  return null;
}

/**
 * Get pipeline by type
 */
export function getPipelineByType(type: PipelineType): PipelineDefinition | null {
  return PIPELINES.find(p => p.type === type) || null;
}

// -----------------------------------------------------------------------------
// Pipeline Execution
// -----------------------------------------------------------------------------

/**
 * Create a pipeline execution plan with task instructions
 */
export function createPipelineExecution(
  pipeline: PipelineDefinition
): {
  execution: PipelineExecution;
  tasks: TaskCreateInstruction[];
} {
  const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Create task instructions for each step
  const tasks: TaskCreateInstruction[] = [];
  const taskIds: Record<number, string> = {};

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    const taskId = `task-${pipelineId}-${i}`;
    taskIds[i] = taskId;

    const metadata: TaskMetadata = {
      source: 'pipeline',
      dispatchedAgent: step.agent,
      pipelineId,
      pipelineStep: i,
      relatedSkills: step.skills,
    };

    // Build blockedBy from dependsOn
    const blockedBy = step.dependsOn.map(dep => taskIds[dep]).filter(Boolean);

    tasks.push({
      subject: `[${pipeline.name}] Step ${i + 1}: ${step.description}`,
      description: `Pipeline step: ${step.agent}\n\n${step.description}\n\nEstimated tokens: ${step.estimatedTokens}`,
      activeForm: `Running ${step.agent}`,
      metadata,
      blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
    });
  }

  const execution: PipelineExecution = {
    pipelineId,
    type: pipeline.type,
    startedAt: new Date().toISOString(),
    taskIds,
    currentStep: 0,
    completedSteps: [],
    status: 'running',
  };

  return { execution, tasks };
}

/**
 * Register pipeline and tasks with tracking systems
 */
export function registerPipelineExecution(
  execution: PipelineExecution,
  tasks: TaskCreateInstruction[]
): void {
  // Register pipeline
  registerPipeline(execution);

  // Register each task
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskId = execution.taskIds[i];

    if (taskId && task.metadata.dispatchedAgent) {
      registerTask(
        taskId,
        task.metadata.dispatchedAgent,
        task.metadata.dispatchConfidence || 100,
        execution.pipelineId,
        i
      );
    }
  }

  logHook(
    'multi-agent-coordinator',
    `Registered pipeline ${execution.pipelineId} with ${tasks.length} tasks`
  );
}

// -----------------------------------------------------------------------------
// Message Formatting
// -----------------------------------------------------------------------------

/**
 * Format pipeline plan as markdown for user
 */
export function formatPipelinePlan(
  pipeline: PipelineDefinition,
  execution: PipelineExecution,
  tasks: TaskCreateInstruction[]
): string {
  let md = `## 🔄 Pipeline Detected: ${pipeline.name}

${pipeline.description}

**Pipeline ID:** \`${execution.pipelineId}\`
**Estimated Total Tokens:** ~${pipeline.estimatedTotalTokens}

### Pipeline Steps

`;

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    const deps = step.dependsOn.length > 0
      ? ` (after steps: ${step.dependsOn.map(d => d + 1).join(', ')})`
      : ' (can start immediately)';

    md += `**${i + 1}. ${step.agent}**${deps}
   ${step.description}
   Skills: ${step.skills?.join(', ') || 'none'}

`;
  }

  md += `### Task Creation Instructions

Create these tasks to track the pipeline:

`;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    md += `**Task ${i + 1}:**
\`\`\`
TaskCreate:
  subject: "${task.subject}"
  activeForm: "${task.activeForm}"
${task.blockedBy ? `  blockedBy: ${JSON.stringify(task.blockedBy)}` : ''}
\`\`\`

`;
  }

  md += `### Start Pipeline

After creating all tasks, spawn the first agent:

\`\`\`
Task tool with subagent_type: "${pipeline.steps[0].agent}"
\`\`\`

The orchestration layer will track progress and suggest next agents as steps complete.`;

  return md;
}
