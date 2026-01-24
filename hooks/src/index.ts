/**
 * OrchestKit Hooks - TypeScript/ESM Entry Point
 *
 * This file exports all hooks and utilities for the bundle.
 * The hook registry maps hook names to their implementations.
 */

// Re-export types
export * from './types.js';

// Re-export utilities
export * from './lib/common.js';
export * from './lib/git.js';
export * from './lib/guards.js';

// Re-export orchestration modules (Issue #197)
export * from './lib/orchestration-types.js';
export * from './lib/intent-classifier.js';
export * from './lib/orchestration-state.js';
export * from './lib/task-integration.js';
export * from './lib/retry-manager.js';
export * from './lib/calibration-engine.js';
export * from './lib/multi-agent-coordinator.js';

// Re-export decision history module (Issues #203, #206, #207, #208)
export * from './lib/decision-history.js';

// Import hook implementations
// Permission hooks
import { autoApproveReadonly } from './permission/auto-approve-readonly.js';
import { autoApproveSafeBash } from './permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from './permission/auto-approve-project-writes.js';
import { learningTracker } from './permission/learning-tracker.js';

// PreTool/Bash hooks
import { dangerousCommandBlocker } from './pretool/bash/dangerous-command-blocker.js';
import { gitValidator } from './pretool/bash/git-validator.js';
import { compoundCommandValidator } from './pretool/bash/compound-command-validator.js';
import { defaultTimeoutSetter } from './pretool/bash/default-timeout-setter.js';
import { errorPatternWarner } from './pretool/bash/error-pattern-warner.js';
import { conflictPredictor } from './pretool/bash/conflict-predictor.js';
import { affectedTestsFinder } from './pretool/bash/affected-tests-finder.js';
import { ciSimulation } from './pretool/bash/ci-simulation.js';
import { preCommitSimulation } from './pretool/bash/pre-commit-simulation.js';
import { prMergeGate } from './pretool/bash/pr-merge-gate.js';
import { changelogGenerator } from './pretool/bash/changelog-generator.js';
import { versionSync } from './pretool/bash/version-sync.js';
import { licenseCompliance } from './pretool/bash/license-compliance.js';
import { ghIssueCreationGuide } from './pretool/bash/gh-issue-creation-guide.js';
import { issueDocsRequirement } from './pretool/bash/issue-docs-requirement.js';
import { multiInstanceQualityGate } from './pretool/bash/multi-instance-quality-gate.js';
import { agentBrowserSafety } from './pretool/bash/agent-browser-safety.js';

// PreTool/Write-Edit hooks
import { fileGuard } from './pretool/write-edit/file-guard.js';
import { fileLockCheck } from './pretool/write-edit/file-lock-check.js';
import { multiInstanceLock } from './pretool/write-edit/multi-instance-lock.js';

// PreTool/Write hooks
import { architectureChangeDetector } from './pretool/Write/architecture-change-detector.js';
import { codeQualityGate } from './pretool/Write/code-quality-gate.js';
import { docstringEnforcer } from './pretool/Write/docstring-enforcer.js';
import { securityPatternValidator } from './pretool/Write/security-pattern-validator.js';

// PreTool/MCP hooks
import { context7Tracker } from './pretool/mcp/context7-tracker.js';
import { memoryFabricInit } from './pretool/mcp/memory-fabric-init.js';
import { memoryValidator } from './pretool/mcp/memory-validator.js';
import { sequentialThinkingAuto } from './pretool/mcp/sequential-thinking-auto.js';

// PreTool/InputMod hooks
import { writeHeaders } from './pretool/input-mod/write-headers.js';

// PreTool/Skill hooks
import { skillTracker } from './pretool/skill/skill-tracker.js';

// Skill hooks (24)
import { backendFileNaming } from './skill/backend-file-naming.js';
import { backendLayerValidator } from './skill/backend-layer-validator.js';
import { coverageCheck } from './skill/coverage-check.js';
import { coverageThresholdGate } from './skill/coverage-threshold-gate.js';
import { crossInstanceTestValidator } from './skill/cross-instance-test-validator.js';
import { decisionEntityExtractor } from './skill/decision-entity-extractor.js';
import { designDecisionSaver } from './skill/design-decision-saver.js';
import { diPatternEnforcer } from './skill/di-pattern-enforcer.js';
import { duplicateCodeDetector } from './skill/duplicate-code-detector.js';
import { evalMetricsCollector } from './skill/eval-metrics-collector.js';
import { evidenceCollector } from './skill/evidence-collector.js';
import { importDirectionEnforcer } from './skill/import-direction-enforcer.js';
import { mem0DecisionSaver } from './skill/mem0-decision-saver.js';
import { mergeConflictPredictor } from './skill/merge-conflict-predictor.js';
import { mergeReadinessChecker } from './skill/merge-readiness-checker.js';
import { migrationValidator } from './skill/migration-validator.js';
import { patternConsistencyEnforcer } from './skill/pattern-consistency-enforcer.js';
import { redactSecrets } from './skill/redact-secrets.js';
import { reviewSummaryGenerator } from './skill/review-summary-generator.js';
import { securitySummary } from './skill/security-summary.js';
import { structureLocationValidator } from './skill/structure-location-validator.js';
import { testLocationValidator } from './skill/test-location-validator.js';
import { testPatternValidator } from './skill/test-pattern-validator.js';
import { testRunner } from './skill/test-runner.js';

// Prompt hooks (UserPromptSubmit)
import { antipatternDetector } from './prompt/antipattern-detector.js';
import { antipatternWarning } from './prompt/antipattern-warning.js';
import { contextInjector } from './prompt/context-injector.js';
import { contextPruningAdvisor } from './prompt/context-pruning-advisor.js';
import { memoryContext } from './prompt/memory-context.js';
import { satisfactionDetector } from './prompt/satisfaction-detector.js';
import { skillAutoSuggest } from './prompt/skill-auto-suggest.js';
import { todoEnforcer } from './prompt/todo-enforcer.js';
import { agentAutoSuggest } from './prompt/agent-auto-suggest.js';

// Prompt hooks - Orchestration (Issue #197)
import { agentOrchestrator } from './prompt/agent-orchestrator.js';
import { skillInjector } from './prompt/skill-injector.js';
import { pipelineDetector } from './prompt/pipeline-detector.js';

// SubagentStart hooks (5)
import { agentMemoryInject } from './subagent-start/agent-memory-inject.js';
import { contextGate } from './subagent-start/context-gate.js';
import { subagentContextStager } from './subagent-start/subagent-context-stager.js';
import { subagentValidator } from './subagent-start/subagent-validator.js';
import { taskLinker } from './subagent-start/task-linker.js';

// SubagentStop hooks (11)
import { agentMemoryStore } from './subagent-stop/agent-memory-store.js';
import { autoSpawnQuality } from './subagent-stop/auto-spawn-quality.js';
import { contextPublisher } from './subagent-stop/context-publisher.js';
import { feedbackLoop } from './subagent-stop/feedback-loop.js';
import { handoffPreparer } from './subagent-stop/handoff-preparer.js';
import { multiClaudeVerifier } from './subagent-stop/multi-claude-verifier.js';
import { outputValidator } from './subagent-stop/output-validator.js';
import { subagentCompletionTracker } from './subagent-stop/subagent-completion-tracker.js';
import { subagentQualityGate } from './subagent-stop/subagent-quality-gate.js';
import { taskCompleter } from './subagent-stop/task-completer.js';
import { retryHandler } from './subagent-stop/retry-handler.js';

// Notification hooks (2)
import { desktopNotification } from './notification/desktop.js';
import { soundNotification } from './notification/sound.js';

// Stop hooks (12)
import { autoRememberContinuity } from './stop/auto-remember-continuity.js';
import { autoSaveContext } from './stop/auto-save-context.js';
import { cleanupInstance } from './stop/cleanup-instance.js';
import { contextCompressor } from './stop/context-compressor.js';
import { fullTestSuite } from './stop/full-test-suite.js';
import { issueWorkSummary } from './stop/issue-work-summary.js';
import { mem0PreCompactionSync } from './stop/mem0-pre-compaction-sync.js';
import { multiInstanceCleanup } from './stop/multi-instance-cleanup.js';
import { securityScanAggregator } from './stop/security-scan-aggregator.js';
import { sessionPatterns } from './stop/session-patterns.js';
import { taskCompletionCheck } from './stop/task-completion-check.js';
import { calibrationPersist } from './stop/calibration-persist.js';

// Setup hooks (7)
import { firstRunSetup } from './setup/first-run-setup.js';
import { mem0AnalyticsDashboard } from './setup/mem0-analytics-dashboard.js';
import { mem0BackupSetup } from './setup/mem0-backup-setup.js';
import { mem0Cleanup } from './setup/mem0-cleanup.js';
import { setupCheck } from './setup/setup-check.js';
import { setupMaintenance } from './setup/setup-maintenance.js';
import { setupRepair } from './setup/setup-repair.js';

// Agent hooks (6)
import { a11yLintCheck } from './agent/a11y-lint-check.js';
import { blockWrites } from './agent/block-writes.js';
import { ciSafetyCheck } from './agent/ci-safety-check.js';
import { deploymentSafetyCheck } from './agent/deployment-safety-check.js';
import { migrationSafetyCheck } from './agent/migration-safety-check.js';
import { securityCommandAudit } from './agent/security-command-audit.js';

// PostTool hooks - Root (13)
import { auditLogger } from './posttool/audit-logger.js';
import { autoLint } from './posttool/auto-lint.js';
import { contextBudgetMonitor } from './posttool/context-budget-monitor.js';
import { coordinationHeartbeat } from './posttool/coordination-heartbeat.js';
import { errorCollector } from './posttool/error-collector.js';
import { errorSolutionSuggester } from './posttool/error-solution-suggester.js';
import { errorTracker } from './posttool/error-tracker.js';
import { mem0WebhookHandler } from './posttool/mem0-webhook-handler.js';
import { memoryBridge } from './posttool/memory-bridge.js';
import { realtimeSync } from './posttool/realtime-sync.js';
import { sessionMetrics } from './posttool/session-metrics.js';
import { skillEditTracker } from './posttool/skill-edit-tracker.js';
import { calibrationTracker } from './posttool/calibration-tracker.js';

// PostTool/Write hooks (5)
import { codeStyleLearner } from './posttool/write/code-style-learner.js';
import { coveragePredictor } from './posttool/write/coverage-predictor.js';
import { namingConventionLearner } from './posttool/write/naming-convention-learner.js';
import { readmeSync } from './posttool/write/readme-sync.js';
import { releaseLockOnCommit } from './posttool/write/release-lock-on-commit.js';

// PostTool/Bash hooks (3)
import { issueProgressCommenter } from './posttool/bash/issue-progress-commenter.js';
import { issueSubtaskUpdater } from './posttool/bash/issue-subtask-updater.js';
import { patternExtractor } from './posttool/bash/pattern-extractor.js';

// PostTool/Skill hooks (1)
import { skillUsageOptimizer } from './posttool/skill/skill-usage-optimizer.js';

// PostTool/Write-Edit hooks (1)
import { fileLockRelease } from './posttool/write-edit/file-lock-release.js';

// Lifecycle hooks (17) - SessionStart/SessionEnd
import { analyticsConsentCheck } from './lifecycle/analytics-consent-check.js';
import { coordinationCleanup } from './lifecycle/coordination-cleanup.js';
import { coordinationInit } from './lifecycle/coordination-init.js';
import { decisionSyncPull } from './lifecycle/decision-sync-pull.js';
import { decisionSyncPush } from './lifecycle/decision-sync-push.js';
import { instanceHeartbeat } from './lifecycle/instance-heartbeat.js';
import { mem0AnalyticsTracker } from './lifecycle/mem0-analytics-tracker.js';
import { mem0ContextRetrieval } from './lifecycle/mem0-context-retrieval.js';
import { mem0WebhookSetup } from './lifecycle/mem0-webhook-setup.js';
import { multiInstanceInit } from './lifecycle/multi-instance-init.js';
import { patternSyncPull } from './lifecycle/pattern-sync-pull.js';
import { patternSyncPush } from './lifecycle/pattern-sync-push.js';
import { sessionCleanup } from './lifecycle/session-cleanup.js';
import { sessionContextLoader } from './lifecycle/session-context-loader.js';
import { sessionEnvSetup } from './lifecycle/session-env-setup.js';
import { sessionMetricsSummary } from './lifecycle/session-metrics-summary.js';
import { dependencyVersionCheck } from './lifecycle/dependency-version-check.js';

import type { HookFn } from './types.js';

/**
 * Hook registry - maps hook names to implementations
 *
 * Hook names use the format: <category>/<hook-name>
 * e.g., 'permission/auto-approve-readonly', 'pretool/bash/git-branch-protection'
 */
export const hooks: Record<string, HookFn> = {
  // Permission hooks (4)
  'permission/auto-approve-readonly': autoApproveReadonly,
  'permission/auto-approve-safe-bash': autoApproveSafeBash,
  'permission/auto-approve-project-writes': autoApproveProjectWrites,
  'permission/learning-tracker': learningTracker,

  // PreTool/Bash hooks (17 - consolidated git hooks)
  'pretool/bash/dangerous-command-blocker': dangerousCommandBlocker,
  'pretool/bash/git-validator': gitValidator,
  'pretool/bash/compound-command-validator': compoundCommandValidator,
  'pretool/bash/default-timeout-setter': defaultTimeoutSetter,
  'pretool/bash/error-pattern-warner': errorPatternWarner,
  'pretool/bash/conflict-predictor': conflictPredictor,
  'pretool/bash/affected-tests-finder': affectedTestsFinder,
  'pretool/bash/ci-simulation': ciSimulation,
  'pretool/bash/pre-commit-simulation': preCommitSimulation,
  'pretool/bash/pr-merge-gate': prMergeGate,
  'pretool/bash/changelog-generator': changelogGenerator,
  'pretool/bash/version-sync': versionSync,
  'pretool/bash/license-compliance': licenseCompliance,
  'pretool/bash/gh-issue-creation-guide': ghIssueCreationGuide,
  'pretool/bash/issue-docs-requirement': issueDocsRequirement,
  'pretool/bash/multi-instance-quality-gate': multiInstanceQualityGate,
  'pretool/bash/agent-browser-safety': agentBrowserSafety,

  // PreTool/Write-Edit hooks (3)
  'pretool/write-edit/file-guard': fileGuard,
  'pretool/write-edit/file-lock-check': fileLockCheck,
  'pretool/write-edit/multi-instance-lock': multiInstanceLock,

  // PreTool/Write hooks (4)
  'pretool/Write/architecture-change-detector': architectureChangeDetector,
  'pretool/Write/code-quality-gate': codeQualityGate,
  'pretool/Write/docstring-enforcer': docstringEnforcer,
  'pretool/Write/security-pattern-validator': securityPatternValidator,

  // PreTool/MCP hooks (4)
  'pretool/mcp/context7-tracker': context7Tracker,
  'pretool/mcp/memory-fabric-init': memoryFabricInit,
  'pretool/mcp/memory-validator': memoryValidator,
  'pretool/mcp/sequential-thinking-auto': sequentialThinkingAuto,

  // PreTool/InputMod hooks (1)
  'pretool/input-mod/write-headers': writeHeaders,

  // PreTool/Skill hooks (1)
  'pretool/skill/skill-tracker': skillTracker,

  // Prompt hooks (12) - UserPromptSubmit
  'prompt/antipattern-detector': antipatternDetector,
  'prompt/antipattern-warning': antipatternWarning,
  'prompt/context-injector': contextInjector,
  'prompt/context-pruning-advisor': contextPruningAdvisor,
  'prompt/memory-context': memoryContext,
  'prompt/satisfaction-detector': satisfactionDetector,
  'prompt/skill-auto-suggest': skillAutoSuggest,
  'prompt/todo-enforcer': todoEnforcer,
  'prompt/agent-auto-suggest': agentAutoSuggest,
  // Orchestration hooks (Issue #197)
  'prompt/agent-orchestrator': agentOrchestrator,
  'prompt/skill-injector': skillInjector,
  'prompt/pipeline-detector': pipelineDetector,

  // SubagentStart hooks (5)
  'subagent-start/agent-memory-inject': agentMemoryInject,
  'subagent-start/context-gate': contextGate,
  'subagent-start/subagent-context-stager': subagentContextStager,
  'subagent-start/subagent-validator': subagentValidator,
  'subagent-start/task-linker': taskLinker,

  // SubagentStop hooks (11)
  'subagent-stop/agent-memory-store': agentMemoryStore,
  'subagent-stop/auto-spawn-quality': autoSpawnQuality,
  'subagent-stop/context-publisher': contextPublisher,
  'subagent-stop/feedback-loop': feedbackLoop,
  'subagent-stop/handoff-preparer': handoffPreparer,
  'subagent-stop/multi-claude-verifier': multiClaudeVerifier,
  'subagent-stop/output-validator': outputValidator,
  'subagent-stop/subagent-completion-tracker': subagentCompletionTracker,
  'subagent-stop/subagent-quality-gate': subagentQualityGate,
  'subagent-stop/task-completer': taskCompleter,
  'subagent-stop/retry-handler': retryHandler,

  // Notification hooks (2)
  'notification/desktop': desktopNotification,
  'notification/sound': soundNotification,

  // Skill hooks (24)
  'skill/backend-file-naming': backendFileNaming,
  'skill/backend-layer-validator': backendLayerValidator,
  'skill/coverage-check': coverageCheck,
  'skill/coverage-threshold-gate': coverageThresholdGate,
  'skill/cross-instance-test-validator': crossInstanceTestValidator,
  'skill/decision-entity-extractor': decisionEntityExtractor,
  'skill/design-decision-saver': designDecisionSaver,
  'skill/di-pattern-enforcer': diPatternEnforcer,
  'skill/duplicate-code-detector': duplicateCodeDetector,
  'skill/eval-metrics-collector': evalMetricsCollector,
  'skill/evidence-collector': evidenceCollector,
  'skill/import-direction-enforcer': importDirectionEnforcer,
  'skill/mem0-decision-saver': mem0DecisionSaver,
  'skill/merge-conflict-predictor': mergeConflictPredictor,
  'skill/merge-readiness-checker': mergeReadinessChecker,
  'skill/migration-validator': migrationValidator,
  'skill/pattern-consistency-enforcer': patternConsistencyEnforcer,
  'skill/redact-secrets': redactSecrets,
  'skill/review-summary-generator': reviewSummaryGenerator,
  'skill/security-summary': securitySummary,
  'skill/structure-location-validator': structureLocationValidator,
  'skill/test-location-validator': testLocationValidator,
  'skill/test-pattern-validator': testPatternValidator,
  'skill/test-runner': testRunner,

  // Stop hooks (12)
  'stop/auto-remember-continuity': autoRememberContinuity,
  'stop/auto-save-context': autoSaveContext,
  'stop/cleanup-instance': cleanupInstance,
  'stop/context-compressor': contextCompressor,
  'stop/full-test-suite': fullTestSuite,
  'stop/issue-work-summary': issueWorkSummary,
  'stop/mem0-pre-compaction-sync': mem0PreCompactionSync,
  'stop/multi-instance-cleanup': multiInstanceCleanup,
  'stop/security-scan-aggregator': securityScanAggregator,
  'stop/session-patterns': sessionPatterns,
  'stop/task-completion-check': taskCompletionCheck,
  'stop/calibration-persist': calibrationPersist,

  // Setup hooks (7)
  'setup/first-run-setup': firstRunSetup,
  'setup/mem0-analytics-dashboard': mem0AnalyticsDashboard,
  'setup/mem0-backup-setup': mem0BackupSetup,
  'setup/mem0-cleanup': mem0Cleanup,
  'setup/setup-check': setupCheck,
  'setup/setup-maintenance': setupMaintenance,
  'setup/setup-repair': setupRepair,

  // Agent hooks (6)
  'agent/a11y-lint-check': a11yLintCheck,
  'agent/block-writes': blockWrites,
  'agent/ci-safety-check': ciSafetyCheck,
  'agent/deployment-safety-check': deploymentSafetyCheck,
  'agent/migration-safety-check': migrationSafetyCheck,
  'agent/security-command-audit': securityCommandAudit,

  // PostTool hooks - Root (13)
  'posttool/audit-logger': auditLogger,
  'posttool/auto-lint': autoLint,
  'posttool/context-budget-monitor': contextBudgetMonitor,
  'posttool/coordination-heartbeat': coordinationHeartbeat,
  'posttool/error-collector': errorCollector,
  'posttool/error-solution-suggester': errorSolutionSuggester,
  'posttool/error-tracker': errorTracker,
  'posttool/mem0-webhook-handler': mem0WebhookHandler,
  'posttool/memory-bridge': memoryBridge,
  'posttool/realtime-sync': realtimeSync,
  'posttool/session-metrics': sessionMetrics,
  'posttool/skill-edit-tracker': skillEditTracker,
  'posttool/calibration-tracker': calibrationTracker,

  // PostTool/Write hooks (5)
  'posttool/write/code-style-learner': codeStyleLearner,
  'posttool/write/coverage-predictor': coveragePredictor,
  'posttool/write/naming-convention-learner': namingConventionLearner,
  'posttool/write/readme-sync': readmeSync,
  'posttool/write/release-lock-on-commit': releaseLockOnCommit,

  // PostTool/Bash hooks (3)
  'posttool/bash/issue-progress-commenter': issueProgressCommenter,
  'posttool/bash/issue-subtask-updater': issueSubtaskUpdater,
  'posttool/bash/pattern-extractor': patternExtractor,

  // PostTool/Skill hooks (1)
  'posttool/skill/skill-usage-optimizer': skillUsageOptimizer,

  // PostTool/Write-Edit hooks (1)
  'posttool/write-edit/file-lock-release': fileLockRelease,

  // Lifecycle hooks (17) - SessionStart/SessionEnd
  'lifecycle/analytics-consent-check': analyticsConsentCheck,
  'lifecycle/coordination-cleanup': coordinationCleanup,
  'lifecycle/coordination-init': coordinationInit,
  'lifecycle/decision-sync-pull': decisionSyncPull,
  'lifecycle/decision-sync-push': decisionSyncPush,
  'lifecycle/instance-heartbeat': instanceHeartbeat,
  'lifecycle/mem0-analytics-tracker': mem0AnalyticsTracker,
  'lifecycle/mem0-context-retrieval': mem0ContextRetrieval,
  'lifecycle/mem0-webhook-setup': mem0WebhookSetup,
  'lifecycle/multi-instance-init': multiInstanceInit,
  'lifecycle/pattern-sync-pull': patternSyncPull,
  'lifecycle/pattern-sync-push': patternSyncPush,
  'lifecycle/session-cleanup': sessionCleanup,
  'lifecycle/session-context-loader': sessionContextLoader,
  'lifecycle/session-env-setup': sessionEnvSetup,
  'lifecycle/session-metrics-summary': sessionMetricsSummary,
  'lifecycle/dependency-version-check': dependencyVersionCheck,
};

/**
 * Get a hook by name
 */
export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

/**
 * List all registered hooks
 */
export function listHooks(): string[] {
  return Object.keys(hooks);
}

/**
 * Run a hook by name
 */
export async function runHook(
  name: string,
  input: Parameters<HookFn>[0]
): Promise<ReturnType<HookFn>> {
  const hook = getHook(name);
  if (!hook) {
    return { continue: true, suppressOutput: true };
  }
  return hook(input);
}
