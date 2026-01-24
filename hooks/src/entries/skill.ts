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

// Skill hooks (24)
import { backendFileNaming } from '../skill/backend-file-naming.js';
import { backendLayerValidator } from '../skill/backend-layer-validator.js';
import { coverageCheck } from '../skill/coverage-check.js';
import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { crossInstanceTestValidator } from '../skill/cross-instance-test-validator.js';
import { decisionEntityExtractor } from '../skill/decision-entity-extractor.js';
import { designDecisionSaver } from '../skill/design-decision-saver.js';
import { diPatternEnforcer } from '../skill/di-pattern-enforcer.js';
import { duplicateCodeDetector } from '../skill/duplicate-code-detector.js';
import { evalMetricsCollector } from '../skill/eval-metrics-collector.js';
import { evidenceCollector } from '../skill/evidence-collector.js';
import { importDirectionEnforcer } from '../skill/import-direction-enforcer.js';
import { mem0DecisionSaver } from '../skill/mem0-decision-saver.js';
import { mergeConflictPredictor } from '../skill/merge-conflict-predictor.js';
import { mergeReadinessChecker } from '../skill/merge-readiness-checker.js';
import { migrationValidator } from '../skill/migration-validator.js';
import { patternConsistencyEnforcer } from '../skill/pattern-consistency-enforcer.js';
import { redactSecrets } from '../skill/redact-secrets.js';
import { reviewSummaryGenerator } from '../skill/review-summary-generator.js';
import { securitySummary } from '../skill/security-summary.js';
import { structureLocationValidator } from '../skill/structure-location-validator.js';
import { testLocationValidator } from '../skill/test-location-validator.js';
import { testPatternValidator } from '../skill/test-pattern-validator.js';
import { testRunner } from '../skill/test-runner.js';

import type { HookFn } from '../types.js';

/**
 * Skill hooks registry
 */
export const hooks: Record<string, HookFn> = {
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
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
