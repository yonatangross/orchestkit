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

// PostTool hooks - Root (11)
import { auditLogger } from '../posttool/audit-logger.js';
import { unifiedErrorHandler } from '../posttool/unified-error-handler.js';
import { realtimeSync } from '../posttool/realtime-sync.js';
import { userTracking } from '../posttool/user-tracking.js';
import { sessionMetrics } from '../posttool/session-metrics.js';
import { skillEditTracker } from '../posttool/skill-edit-tracker.js';
import { dirtyFileTracker } from '../posttool/dirty-file-tracker.js';
import { unifiedDispatcher } from '../posttool/unified-dispatcher.js';

// PostTool/Write hooks (3) — #922: removed dead entries (auto-lint, memory-bridge, coverage-predictor, readme-sync)
import { codeStyleLearner } from '../posttool/write/code-style-learner.js';
import { namingConventionLearner } from '../posttool/write/naming-convention-learner.js';
// PostTool/Bash hooks (3)
import { issueProgressCommenter } from '../posttool/bash/issue-progress-commenter.js';
import { issueSubtaskUpdater } from '../posttool/bash/issue-subtask-updater.js';
import { patternExtractor } from '../posttool/bash/pattern-extractor.js';

// PostTool/Skill hooks (1)
import { skillUsageOptimizer } from '../posttool/skill/skill-usage-optimizer.js';

// PostTool/Expect hooks (1) — fingerprint auto-save (#1191)
import { fingerprintSaver } from '../posttool/expect/fingerprint-saver.js';

// PostTool/Task hooks (1) — Agent Teams
import { teamMemberStart } from '../posttool/task/team-member-start.js';

// PostTool/Failure hooks (1)
import { failureHandler } from '../posttool/failure-handler.js';

// Intelligent Decision Capture System
import { toolPreferenceLearner } from '../posttool/tool-preference-learner.js';

// MCP output transformation (CC 2.1.89)
import { mcpOutputTransform } from '../posttool/mcp-output-transform.js';

// Issue #772: Config change security auditor
import { configChangeAuditor } from '../posttool/config-change/security-auditor.js';

import type { HookFn } from '../types.js';

/**
 * PostTool hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // PostTool hooks - Root (10)
  'posttool/audit-logger': auditLogger,
  'posttool/unified-error-handler': unifiedErrorHandler,
  'posttool/realtime-sync': realtimeSync,
  'posttool/user-tracking': userTracking,
  'posttool/session-metrics': sessionMetrics,
  'posttool/skill-edit-tracker': skillEditTracker,
  'posttool/dirty-file-tracker': dirtyFileTracker,
  'posttool/unified-dispatcher': unifiedDispatcher,

  // PostTool/Write hooks (2) — #922: removed coverage-predictor, readme-sync
  'posttool/write/code-style-learner': codeStyleLearner,
  'posttool/write/naming-convention-learner': namingConventionLearner,

  // PostTool/Bash hooks (3)
  'posttool/bash/issue-progress-commenter': issueProgressCommenter,
  'posttool/bash/issue-subtask-updater': issueSubtaskUpdater,
  'posttool/bash/pattern-extractor': patternExtractor,

  // PostTool/Skill hooks (1)
  'posttool/skill/skill-usage-optimizer': skillUsageOptimizer,

  // PostTool/Expect hooks (1) — fingerprint auto-save (#1191)
  'posttool/expect/fingerprint-saver': fingerprintSaver,

  // PostTool/Task hooks (1) — Agent Teams
  'posttool/task/team-member-start': teamMemberStart,

  // PostTool/Failure hooks (1)
  'posttool/failure-handler': failureHandler,

  // Intelligent Decision Capture System
  'posttool/tool-preference-learner': toolPreferenceLearner,

  // MCP output transformation (CC 2.1.89)
  'posttool/mcp-output-transform': mcpOutputTransform,

  // Issue #772: Config change security auditor
  'posttool/config-change/security-auditor': configChangeAuditor,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
