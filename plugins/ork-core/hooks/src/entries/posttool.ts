/**
 * PostTool Hooks Entry Point
 *
 * Hooks that run after tool execution (PostToolUse)
 * Bundle: posttool.mjs (~45 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/git.js';

// PostTool hooks - Root (13)
import { auditLogger } from '../posttool/audit-logger.js';
import { unifiedErrorHandler } from '../posttool/unified-error-handler.js';
import { autoLint } from '../posttool/auto-lint.js';
import { contextBudgetMonitor } from '../posttool/context-budget-monitor.js';
import { coordinationHeartbeat } from '../posttool/coordination-heartbeat.js';
import { mem0WebhookHandler } from '../posttool/mem0-webhook-handler.js';
import { memoryBridge } from '../posttool/memory-bridge.js';
import { realtimeSync } from '../posttool/realtime-sync.js';
import { sessionMetrics } from '../posttool/session-metrics.js';
import { skillEditTracker } from '../posttool/skill-edit-tracker.js';
import { calibrationTracker } from '../posttool/calibration-tracker.js';

// PostTool/Write hooks (5)
import { codeStyleLearner } from '../posttool/write/code-style-learner.js';
import { coveragePredictor } from '../posttool/write/coverage-predictor.js';
import { namingConventionLearner } from '../posttool/write/naming-convention-learner.js';
import { readmeSync } from '../posttool/write/readme-sync.js';
import { releaseLockOnCommit } from '../posttool/write/release-lock-on-commit.js';

// PostTool/Bash hooks (3)
import { issueProgressCommenter } from '../posttool/bash/issue-progress-commenter.js';
import { issueSubtaskUpdater } from '../posttool/bash/issue-subtask-updater.js';
import { patternExtractor } from '../posttool/bash/pattern-extractor.js';

// PostTool/Skill hooks (1)
import { skillUsageOptimizer } from '../posttool/skill/skill-usage-optimizer.js';

// PostTool/Write-Edit hooks (1)
import { fileLockRelease } from '../posttool/write-edit/file-lock-release.js';

import type { HookFn } from '../types.js';

/**
 * PostTool hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // PostTool hooks - Root (13)
  'posttool/audit-logger': auditLogger,
  'posttool/unified-error-handler': unifiedErrorHandler,
  'posttool/auto-lint': autoLint,
  'posttool/context-budget-monitor': contextBudgetMonitor,
  'posttool/coordination-heartbeat': coordinationHeartbeat,
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
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
