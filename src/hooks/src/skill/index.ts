/**
 * Skill Hooks - TypeScript implementations
 *
 * These hooks are triggered by specific skills and enforce
 * code quality, patterns, and best practices.
 */

export { backendFileNaming } from './backend-file-naming.js';
export { backendLayerValidator } from './backend-layer-validator.js';
export { coverageCheck } from './coverage-check.js';
export { coverageThresholdGate } from './coverage-threshold-gate.js';
export { crossInstanceTestValidator } from './cross-instance-test-validator.js';
export { diPatternEnforcer } from './di-pattern-enforcer.js';
export { duplicateCodeDetector } from './duplicate-code-detector.js';
export { evalMetricsCollector } from './eval-metrics-collector.js';
export { evidenceCollector } from './evidence-collector.js';
export { importDirectionEnforcer } from './import-direction-enforcer.js';
export { mergeConflictPredictor } from './merge-conflict-predictor.js';
export { mergeReadinessChecker } from './merge-readiness-checker.js';
export { migrationValidator } from './migration-validator.js';
export { patternConsistencyEnforcer } from './pattern-consistency-enforcer.js';
export { redactSecrets } from './redact-secrets.js';
export { reviewSummaryGenerator } from './review-summary-generator.js';
export { securitySummary } from './security-summary.js';
export { structureLocationValidator } from './structure-location-validator.js';
export { testLocationValidator } from './test-location-validator.js';
export { testPatternValidator } from './test-pattern-validator.js';
export { testRunner } from './test-runner.js';
export { decisionProcessor } from './decision-processor.js';

// once:true context loaders (CC 2.1.69)
export { prContextLoader, issueContextLoader, commitConventionLoader, planContextLoader, releaseStateLoader } from './context-loaders-git.js';
export { repoStructureIndexer, testFrameworkDetector, projectConventionLoader, doctorEnvSnapshot, setupEnvDetector, priorDecisionsLoader, assessmentBaselineLoader, qualityBaselineLoader } from './context-loaders-env.js';
// once:true standards loaders (CC 2.1.72 cache-opt)
export { implementStandardsLoader, reviewDimensionsLoader, verifyScoringRubricLoader, brainstormInstructionsLoader } from './context-loaders-standards.js';
