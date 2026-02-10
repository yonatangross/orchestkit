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

// PreTool/Write-Edit hooks (1)
import { fileGuard } from '../pretool/write-edit/file-guard.js';

// PreTool/Write hooks (4)
import { architectureChangeDetector } from '../pretool/Write/architecture-change-detector.js';
import { codeQualityGate } from '../pretool/Write/code-quality-gate.js';
import { docstringEnforcer } from '../pretool/Write/docstring-enforcer.js';
import { securityPatternValidator } from '../pretool/Write/security-pattern-validator.js';

// PreTool/MCP hooks (3)
import { context7Tracker } from '../pretool/mcp/context7-tracker.js';
import { memoryFabricInit } from '../pretool/mcp/memory-fabric-init.js';
import { memoryValidator } from '../pretool/mcp/memory-validator.js';

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

  // PreTool/Write-Edit hooks (1)
  'pretool/write-edit/file-guard': fileGuard,

  // PreTool/Write hooks (4)
  'pretool/Write/architecture-change-detector': architectureChangeDetector,
  'pretool/Write/code-quality-gate': codeQualityGate,
  'pretool/Write/docstring-enforcer': docstringEnforcer,
  'pretool/Write/security-pattern-validator': securityPatternValidator,

  // PreTool/MCP hooks (3)
  'pretool/mcp/context7-tracker': context7Tracker,
  'pretool/mcp/memory-fabric-init': memoryFabricInit,
  'pretool/mcp/memory-validator': memoryValidator,

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
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
