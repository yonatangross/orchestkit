/**
 * Skill Hooks Entry Point
 *
 * Hooks that are skill-specific (validation, tracking, etc.)
 * Bundle: skill.mjs (~50 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/git.js';

// Skill hooks (20: 7 validators + 13 once:true context loaders)
import { coverageCheck } from '../skill/coverage-check.js';
import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { crossInstanceTestValidator } from '../skill/cross-instance-test-validator.js';
import { evidenceCollector } from '../skill/evidence-collector.js';
import { patternConsistencyEnforcer } from '../skill/pattern-consistency-enforcer.js';
import { redactSecrets } from '../skill/redact-secrets.js';
import { reviewPostGate } from '../skill/review-post-gate.js';

// once:true context loaders (CC 2.1.69)
import { issueContextLoader, commitConventionLoader } from '../skill/context-loaders-git.js';
import { repoStructureIndexer, testFrameworkDetector, projectConventionLoader, doctorEnvSnapshot, setupEnvDetector, priorDecisionsLoader, assessmentBaselineLoader, qualityBaselineLoader } from '../skill/context-loaders-env.js';
// once:true standards loaders (CC 2.1.72 cache-opt)
import { implementStandardsLoader, verifyScoringRubricLoader, brainstormInstructionsLoader } from '../skill/context-loaders-standards.js';

import type { HookFn } from '../types.js';

/**
 * Skill hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'skill/coverage-check': coverageCheck,
  'skill/coverage-threshold-gate': coverageThresholdGate,
  'skill/cross-instance-test-validator': crossInstanceTestValidator,
  'skill/evidence-collector': evidenceCollector,
  'skill/pattern-consistency-enforcer': patternConsistencyEnforcer,
  'skill/redact-secrets': redactSecrets,
  'skill/review-post-gate': reviewPostGate,
  // once:true context loaders (CC 2.1.69)
  'skill/issue-context-loader': issueContextLoader,
  'skill/commit-convention-loader': commitConventionLoader,
  'skill/repo-structure-indexer': repoStructureIndexer,
  'skill/test-framework-detector': testFrameworkDetector,
  'skill/project-convention-loader': projectConventionLoader,
  'skill/doctor-env-snapshot': doctorEnvSnapshot,
  'skill/setup-env-detector': setupEnvDetector,
  'skill/prior-decisions-loader': priorDecisionsLoader,
  'skill/assessment-baseline-loader': assessmentBaselineLoader,
  'skill/quality-baseline-loader': qualityBaselineLoader,
  // once:true standards loaders (CC 2.1.72 cache-opt)
  'skill/implement-standards-loader': implementStandardsLoader,
  'skill/verify-scoring-rubric-loader': verifyScoringRubricLoader,
  'skill/brainstorm-instructions-loader': brainstormInstructionsLoader,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';
