/**
 * Orchestration Types - Shared type definitions for Agent Orchestration Layer
 * Issue #197: Agent Orchestration Layer with CC 2.1.16 Task Integration
 *
 * These types support:
 * - Intent classification with hybrid scoring
 * - Agent and skill matching
 * - CC 2.1.16 Task system integration
 * - Outcome-based calibration
 * - Multi-agent coordination
 */

// -----------------------------------------------------------------------------
// Confidence Thresholds
// -----------------------------------------------------------------------------

export const THRESHOLDS = {
  /** Auto-dispatch agent without confirmation */
  AUTO_DISPATCH: 85,
  /** Auto-inject skill content */
  SKILL_INJECT: 80,
  /** Strong recommendation shown to user */
  STRONG_RECOMMEND: 70,
  /** Suggestion shown to user */
  SUGGEST: 50,
  /** Minimum confidence to consider */
  MINIMUM: 40,
} as const;

// -----------------------------------------------------------------------------
// Intent Classification Types
// -----------------------------------------------------------------------------

/** Signal types used in intent classification */
export type SignalType =
  | 'keyword'         // Direct keyword match
  | 'phrase'          // Multi-word phrase match
  | 'context'         // Context continuity from history
  | 'cooccurrence'    // Learned keyword co-occurrence
  | 'negation'        // Detected negation reducing confidence
  | 'boost'           // Calibration boost from successful outcomes
  | 'penalty';        // Calibration penalty from failures

/** Individual signal contributing to classification */
export interface IntentSignal {
  type: SignalType;
  source: string;       // What triggered this signal
  weight: number;       // Weight contribution (0-100)
  matched: string;      // What was matched in the prompt
}

/** Match result for an agent */
export interface AgentMatch {
  agent: string;
  confidence: number;
  description: string;
  matchedKeywords: string[];
  signals: IntentSignal[];
}

/** Match result for a skill */
export interface SkillMatch {
  skill: string;
  confidence: number;
  description: string;
  matchedKeywords: string[];
  signals: IntentSignal[];
}

/** Result from intent classification */
export interface ClassificationResult {
  /** Matching agents sorted by confidence */
  agents: AgentMatch[];
  /** Matching skills sorted by confidence */
  skills: SkillMatch[];
  /** Primary detected intent category */
  intent: string;
  /** Highest confidence score across all matches */
  confidence: number;
  /** All signals used in classification */
  signals: IntentSignal[];
  /** Whether this should trigger auto-dispatch */
  shouldAutoDispatch: boolean;
  /** Whether skills should be auto-injected */
  shouldInjectSkills: boolean;
}

// -----------------------------------------------------------------------------
// Orchestration State Types
// -----------------------------------------------------------------------------

/** Action to take based on classification */
export type OrchestrationAction =
  | 'auto-dispatch'    // Immediately spawn agent
  | 'inject-skill'     // Auto-load skill content
  | 'strong-recommend' // Show strong recommendation
  | 'suggest'          // Show suggestion
  | 'none';            // No action needed

/** State for a dispatched agent */
export interface DispatchedAgent {
  agent: string;
  taskId?: string;     // CC 2.1.16 task ID if created
  confidence: number;
  dispatchedAt: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';
  retryCount: number;
  maxRetries: number;
}

/** Current orchestration session state */
export interface OrchestrationState {
  sessionId: string;
  /** Active dispatched agents */
  activeAgents: DispatchedAgent[];
  /** Skills currently injected */
  injectedSkills: string[];
  /** Recent prompts for context continuity */
  promptHistory: string[];
  /** Max prompts to keep in history */
  maxHistorySize: number;
  /** Last classification result */
  lastClassification?: ClassificationResult;
  /** Timestamp of last update */
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// CC 2.1.16 Task Integration Types
// -----------------------------------------------------------------------------

/** Metadata attached to tasks for orchestration */
export interface TaskMetadata {
  /** Source of task creation */
  source: 'orchestration' | 'user' | 'pipeline';
  /** Agent that was dispatched */
  dispatchedAgent?: string;
  /** Classification confidence at dispatch time */
  dispatchConfidence?: number;
  /** Pipeline this task belongs to */
  pipelineId?: string;
  /** Step in pipeline sequence */
  pipelineStep?: number;
  /** Related skill names */
  relatedSkills?: string[];
  /** Signals that triggered dispatch */
  dispatchSignals?: IntentSignal[];
}

/** Instruction to create a CC 2.1.16 task */
export interface TaskCreateInstruction {
  subject: string;
  description: string;
  activeForm: string;
  metadata: TaskMetadata;
  /** Tasks this one is blocked by */
  blockedBy?: string[];
}

/** Instruction to update a CC 2.1.16 task */
export interface TaskUpdateInstruction {
  taskId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'deleted';
  addBlockedBy?: string[];
  addBlocks?: string[];
}

// -----------------------------------------------------------------------------
// Retry and Error Handling Types
// -----------------------------------------------------------------------------

/** Outcome of an agent execution */
export type AgentOutcome = 'success' | 'partial' | 'failure' | 'rejected';

/** Decision on what to do after failure */
export interface RetryDecision {
  shouldRetry: boolean;
  retryCount: number;
  maxRetries: number;
  /** Alternative agent to suggest if giving up */
  alternativeAgent?: string;
  /** Reason for decision */
  reason: string;
  /** Delay before retry in ms */
  delayMs?: number;
}

/** Record of an agent execution attempt */
export interface ExecutionAttempt {
  agent: string;
  taskId?: string;
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  outcome?: AgentOutcome;
  error?: string;
  durationMs?: number;
}

// -----------------------------------------------------------------------------
// Calibration Types
// -----------------------------------------------------------------------------

/** Record of a dispatched agent outcome for calibration */
export interface CalibrationRecord {
  timestamp: string;
  sessionId: string;
  agent: string;
  promptHash: string;        // Hash of triggering prompt
  matchedKeywords: string[];
  dispatchConfidence: number;
  outcome: AgentOutcome;
  durationMs?: number;
  /** User feedback if any */
  feedback?: 'positive' | 'negative' | 'neutral';
}

/** Learned adjustment for keyword/agent pairs */
export interface CalibrationAdjustment {
  keyword: string;
  agent: string;
  /** Positive = boost, negative = penalty */
  adjustment: number;
  sampleCount: number;
  lastUpdated: string;
}

/** Calibration data store */
export interface CalibrationData {
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;
  records: CalibrationRecord[];
  adjustments: CalibrationAdjustment[];
  /** Summary stats for monitoring */
  stats: {
    totalDispatches: number;
    successRate: number;
    avgConfidence: number;
    topAgents: Array<{ agent: string; count: number; successRate: number }>;
  };
}

// -----------------------------------------------------------------------------
// Multi-Agent Pipeline Types
// -----------------------------------------------------------------------------

/** Known pipeline definitions */
export type PipelineType =
  | 'product-thinking'
  | 'full-stack-feature'
  | 'ai-integration'
  | 'security-audit'
  | 'frontend-compliance'
  | 'custom';

/** Step in a multi-agent pipeline */
export interface PipelineStep {
  agent: string;
  description: string;
  /** Task dependencies (step indices) */
  dependsOn: number[];
  /** Skills to inject for this step */
  skills?: string[];
  /** Estimated context tokens for this step */
  estimatedTokens?: number;
}

/** Definition of a multi-agent pipeline */
export interface PipelineDefinition {
  type: PipelineType;
  name: string;
  description: string;
  /** Trigger patterns that activate this pipeline */
  triggers: string[];
  steps: PipelineStep[];
  /** Total estimated tokens for full pipeline */
  estimatedTotalTokens: number;
}

/** Active pipeline execution state */
export interface PipelineExecution {
  pipelineId: string;
  type: PipelineType;
  startedAt: string;
  /** Map of step index to task ID */
  taskIds: Record<number, string>;
  /** Current step being executed */
  currentStep: number;
  /** Completed steps */
  completedSteps: number[];
  status: 'running' | 'completed' | 'failed' | 'paused';
}

// -----------------------------------------------------------------------------
// Configuration Types
// -----------------------------------------------------------------------------

/** Orchestration configuration */
export interface OrchestrationConfig {
  /** Enable auto-dispatch at high confidence */
  enableAutoDispatch: boolean;
  /** Enable skill auto-injection */
  enableSkillInjection: boolean;
  /** Maximum tokens for skill injection */
  maxSkillInjectionTokens: number;
  /** Enable outcome calibration */
  enableCalibration: boolean;
  /** Enable pipeline detection */
  enablePipelines: boolean;
  /** Custom confidence thresholds */
  thresholds?: Partial<typeof THRESHOLDS>;
  /** Max retries for failed agents */
  maxRetries: number;
  /** Retry delay base in ms */
  retryDelayBaseMs: number;
}

/** Default orchestration configuration */
export const DEFAULT_CONFIG: OrchestrationConfig = {
  enableAutoDispatch: true,
  enableSkillInjection: true,
  maxSkillInjectionTokens: 800,
  enableCalibration: true,
  enablePipelines: true,
  maxRetries: 3,
  retryDelayBaseMs: 1000,
};
