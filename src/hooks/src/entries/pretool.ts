/**
 * PreTool Hooks Entry Point
 *
 * Hooks that run before tool execution (PreToolUse validation/modification)
 * Bundle: pretool.mjs (~70 KB estimated - largest bundle)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/git.js';
export * from '../lib/guards.js';

// PreTool/Bash hooks (20)
import { dangerousCommandBlocker } from '../pretool/bash/dangerous-command-blocker.js';
import { gitValidator } from '../pretool/bash/git-validator.js';
import { compoundCommandValidator } from '../pretool/bash/compound-command-validator.js';
import { defaultTimeoutSetter } from '../pretool/bash/default-timeout-setter.js';
import { errorPatternWarner } from '../pretool/bash/error-pattern-warner.js';
import { conflictPredictor } from '../pretool/bash/conflict-predictor.js';
import { affectedTestsFinder } from '../pretool/bash/affected-tests-finder.js';
import { ciSimulation } from '../pretool/bash/ci-simulation.js';
import { preCommitSimulation } from '../pretool/bash/pre-commit-simulation.js';
import { prMergeGate } from '../pretool/bash/pr-merge-gate.js';
import { changelogGenerator } from '../pretool/bash/changelog-generator.js';
import { versionSync } from '../pretool/bash/version-sync.js';
import { licenseCompliance } from '../pretool/bash/license-compliance.js';
import { ghIssueCreationGuide } from '../pretool/bash/gh-issue-creation-guide.js';
import { issueDocsRequirement } from '../pretool/bash/issue-docs-requirement.js';
import { multiInstanceQualityGate } from '../pretool/bash/multi-instance-quality-gate.js';
import { agentBrowserSafety } from '../pretool/bash/agent-browser-safety.js';
import { commitAtomicityChecker } from '../pretool/bash/commit-atomicity-checker.js';
import { issueReferenceChecker } from '../pretool/bash/issue-reference-checker.js';

// PreTool/Write-Edit hooks (2)
import { contentSecretScanner } from '../pretool/write-edit/content-secret-scanner.js';
import { fileGuard } from '../pretool/write-edit/file-guard.js';

// PreTool/Write hooks (4)
import { architectureChangeDetector } from '../pretool/Write/architecture-change-detector.js';
import { codeQualityGate } from '../pretool/Write/code-quality-gate.js';
import { docstringEnforcer } from '../pretool/Write/docstring-enforcer.js';
import { securityPatternValidator } from '../pretool/Write/security-pattern-validator.js';

// PreTool/MCP hooks (3)
import { context7Tracker } from '../pretool/mcp/context7-tracker.js';
import { memoryValidator } from '../pretool/mcp/memory-validator.js';
import { notebooklmAdvisor } from '../pretool/mcp/notebooklm-advisor.js';

// PreTool/InputMod hooks (1)
import { writeHeaders } from '../pretool/input-mod/write-headers.js';

// PreTool/Skill hooks (1)
import { skillTracker } from '../pretool/skill/skill-tracker.js';

// PreTool/Read hooks (1)
import { tldrSummary } from '../pretool/read/tldr-summary.js';

// PreTool/Task hooks (1) — Agent Teams
import { teamSizeGate } from '../pretool/task/team-size-gate.js';

// Unified dispatchers (3) — consolidate sequential hooks into single process
import { unifiedBashAdvisoryDispatcher } from '../pretool/bash/unified-advisory-dispatcher.js';
import { unifiedWriteEditQualityDispatcher } from '../pretool/write-edit/unified-quality-dispatcher.js';
import { unifiedAgentSafetyDispatcher } from '../pretool/task/unified-agent-safety-dispatcher.js';

// Sync dispatchers (3) — consolidate per-matcher hooks into single process (#868)
import { syncBashDispatcher } from '../pretool/bash/sync-bash-dispatcher.js';
import { syncWriteEditDispatcher } from '../pretool/write-edit/sync-write-edit-dispatcher.js';
import { syncTaskDispatcher } from '../pretool/task/sync-task-dispatcher.js';

import type { HookFn } from '../types.js';

/**
 * PreTool hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // PreTool/Bash hooks (20)
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
  'pretool/bash/commit-atomicity-checker': commitAtomicityChecker,
  'pretool/bash/issue-reference-checker': issueReferenceChecker,

  // PreTool/Write-Edit hooks (2)
  'pretool/write-edit/content-secret-scanner': contentSecretScanner,
  'pretool/write-edit/file-guard': fileGuard,

  // PreTool/Write hooks (4)
  'pretool/Write/architecture-change-detector': architectureChangeDetector,
  'pretool/Write/code-quality-gate': codeQualityGate,
  'pretool/Write/docstring-enforcer': docstringEnforcer,
  'pretool/Write/security-pattern-validator': securityPatternValidator,

  // PreTool/MCP hooks (3)
  'pretool/mcp/context7-tracker': context7Tracker,
  'pretool/mcp/memory-validator': memoryValidator,
  'pretool/mcp/notebooklm-advisor': notebooklmAdvisor,

  // PreTool/InputMod hooks (1)
  'pretool/input-mod/write-headers': writeHeaders,

  // PreTool/Skill hooks (1)
  'pretool/skill/skill-tracker': skillTracker,

  // PreTool/Read hooks (1)
  'pretool/read/tldr-summary': tldrSummary,

  // PreTool/Task hooks (1) — Agent Teams
  'pretool/task/team-size-gate': teamSizeGate,

  // Unified dispatchers (3) — consolidate sequential hooks into single process
  'pretool/bash/unified-advisory-dispatcher': unifiedBashAdvisoryDispatcher,
  'pretool/write-edit/unified-quality-dispatcher': unifiedWriteEditQualityDispatcher,
  'pretool/task/unified-agent-safety-dispatcher': unifiedAgentSafetyDispatcher,

  // Sync dispatchers (3) — per-matcher consolidation (#868)
  'pretool/bash/sync-bash-dispatcher': syncBashDispatcher,
  'pretool/write-edit/sync-write-edit-dispatcher': syncWriteEditDispatcher,
  'pretool/task/sync-task-dispatcher': syncTaskDispatcher,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
