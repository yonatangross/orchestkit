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
import { memoryBridge } from '../posttool/memory-bridge.js';
import { realtimeSync } from '../posttool/realtime-sync.js';
import { userTracking } from '../posttool/user-tracking.js';
import { sessionMetrics } from '../posttool/session-metrics.js';
import { skillEditTracker } from '../posttool/skill-edit-tracker.js';
import { calibrationTracker } from '../posttool/calibration-tracker.js';
import { unifiedDispatcher } from '../posttool/unified-dispatcher.js';

// PostTool/Write hooks (5)
import { codeStyleLearner } from '../posttool/write/code-style-learner.js';
import { coveragePredictor } from '../posttool/write/coverage-predictor.js';
import { namingConventionLearner } from '../posttool/write/naming-convention-learner.js';
import { readmeSync } from '../posttool/write/readme-sync.js';
// PostTool/Bash hooks (3)
import { issueProgressCommenter } from '../posttool/bash/issue-progress-commenter.js';
import { issueSubtaskUpdater } from '../posttool/bash/issue-subtask-updater.js';
import { patternExtractor } from '../posttool/bash/pattern-extractor.js';

// PostTool/Skill hooks (1)
import { skillUsageOptimizer } from '../posttool/skill/skill-usage-optimizer.js';

// PostTool/Task hooks (1) — Agent Teams
import { teamMemberStart } from '../posttool/task/team-member-start.js';

// PostTool/Failure hooks (1)
import { failureHandler } from '../posttool/failure-handler.js';

// Intelligent Decision Capture System
import { solutionDetector } from '../posttool/solution-detector.js';
import { toolPreferenceLearner } from '../posttool/tool-preference-learner.js';

// Issue #772: Config change security auditor
import { configChangeAuditor } from '../posttool/config-change/security-auditor.js';

import type { HookFn } from '../types.js';

/**
 * PostTool hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // PostTool hooks - Root (12)
  'posttool/audit-logger': auditLogger,
  'posttool/unified-error-handler': unifiedErrorHandler,
  'posttool/auto-lint': autoLint,
  'posttool/memory-bridge': memoryBridge,
  'posttool/realtime-sync': realtimeSync,
  'posttool/user-tracking': userTracking,
  'posttool/session-metrics': sessionMetrics,
  'posttool/skill-edit-tracker': skillEditTracker,
  'posttool/calibration-tracker': calibrationTracker,
  'posttool/unified-dispatcher': unifiedDispatcher,

  // PostTool/Write hooks (4)
  'posttool/write/code-style-learner': codeStyleLearner,
  'posttool/write/coverage-predictor': coveragePredictor,
  'posttool/write/naming-convention-learner': namingConventionLearner,
  'posttool/write/readme-sync': readmeSync,

  // PostTool/Bash hooks (3)
  'posttool/bash/issue-progress-commenter': issueProgressCommenter,
  'posttool/bash/issue-subtask-updater': issueSubtaskUpdater,
  'posttool/bash/pattern-extractor': patternExtractor,

  // PostTool/Skill hooks (1)
  'posttool/skill/skill-usage-optimizer': skillUsageOptimizer,

  // PostTool/Task hooks (1) — Agent Teams
  'posttool/task/team-member-start': teamMemberStart,

  // PostTool/Failure hooks (1)
  'posttool/failure-handler': failureHandler,

  // Intelligent Decision Capture System
  'posttool/solution-detector': solutionDetector,
  'posttool/tool-preference-learner': toolPreferenceLearner,

  // Issue #772: Config change security auditor
  'posttool/config-change/security-auditor': configChangeAuditor,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
