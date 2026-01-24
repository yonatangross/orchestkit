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
import { gitBranchProtection } from '../pretool/bash/git-branch-protection.js';
import { gitCommitMessageValidator } from '../pretool/bash/git-commit-message-validator.js';
import { gitBranchNamingValidator } from '../pretool/bash/git-branch-naming-validator.js';
import { gitAtomicCommitChecker } from '../pretool/bash/git-atomic-commit-checker.js';
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

// PreTool/Write-Edit hooks (3)
import { fileGuard } from '../pretool/write-edit/file-guard.js';
import { fileLockCheck } from '../pretool/write-edit/file-lock-check.js';
import { multiInstanceLock } from '../pretool/write-edit/multi-instance-lock.js';

// PreTool/Write hooks (4)
import { architectureChangeDetector } from '../pretool/Write/architecture-change-detector.js';
import { codeQualityGate } from '../pretool/Write/code-quality-gate.js';
import { docstringEnforcer } from '../pretool/Write/docstring-enforcer.js';
import { securityPatternValidator } from '../pretool/Write/security-pattern-validator.js';

// PreTool/MCP hooks (4)
import { context7Tracker } from '../pretool/mcp/context7-tracker.js';
import { memoryFabricInit } from '../pretool/mcp/memory-fabric-init.js';
import { memoryValidator } from '../pretool/mcp/memory-validator.js';
import { sequentialThinkingAuto } from '../pretool/mcp/sequential-thinking-auto.js';

// PreTool/InputMod hooks (1)
import { writeHeaders } from '../pretool/input-mod/write-headers.js';

// PreTool/Skill hooks (1)
import { skillTracker } from '../pretool/skill/skill-tracker.js';

import type { HookFn } from '../types.js';

/**
 * PreTool hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // PreTool/Bash hooks (20)
  'pretool/bash/dangerous-command-blocker': dangerousCommandBlocker,
  'pretool/bash/git-branch-protection': gitBranchProtection,
  'pretool/bash/git-commit-message-validator': gitCommitMessageValidator,
  'pretool/bash/git-branch-naming-validator': gitBranchNamingValidator,
  'pretool/bash/git-atomic-commit-checker': gitAtomicCommitChecker,
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
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
