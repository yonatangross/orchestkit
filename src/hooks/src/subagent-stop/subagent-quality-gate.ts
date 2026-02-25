/**
 * Subagent Quality Gate - SubagentStop Hook
 * CC 2.1.7 Compliant: includes continue field in all outputs
 *
 * Validates subagent output quality:
 * 1. Error-presence check (existing gate)
 * 2. Score pattern extraction and threshold validation
 * 3. Output structure validation (evidence/findings presence)
 *
 * Version: 2.0.0 (TypeScript port + schema validation)
 */

import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWarning, logHook, getProjectDir } from '../lib/common.js';
import { getMetricsFile } from '../lib/paths.js';

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const METRICS_FILE = getMetricsFile();

interface VerificationPolicy {
  thresholds?: {
    security_minimum?: number;
    general_minimum?: number;
    [dimension: string]: number | undefined;
  };
}

const DEFAULT_THRESHOLDS = {
  security_minimum: 5.0,
  general_minimum: 3.0,
};

// -----------------------------------------------------------------------------
// Score Extraction
// -----------------------------------------------------------------------------

/** Parsed score from subagent output */
interface ExtractedScore {
  value: number;
  max: number;
  dimension: string | null;
}

/**
 * Extract score patterns from subagent output text.
 * Matches: "Score: 7.5/10", "**Score:** 8/10", '"score": 7.5', "Security: 4/10"
 */
function extractScores(text: string): ExtractedScore[] {
  const scores: ExtractedScore[] = [];
  if (!text) return scores;

  // Pattern 1: "Dimension: N/M" or "**Dimension:** N/M"
  const slashPattern = /\*{0,2}(\w[\w\s]{0,30}?)\*{0,2}\s*:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = slashPattern.exec(text)) !== null) {
    const dimension = match[1].trim().toLowerCase();
    const value = parseFloat(match[2]);
    const max = parseFloat(match[3]);
    if (!isNaN(value) && !isNaN(max) && max > 0) {
      scores.push({ value, max, dimension: dimension === 'score' ? null : dimension });
    }
  }

  // Pattern 2: JSON-style "score": N or "score": N.N
  const jsonPattern = /"(\w+_?score|score)"\s*:\s*(\d+(?:\.\d+)?)/gi;
  while ((match = jsonPattern.exec(text)) !== null) {
    const key = match[1].toLowerCase();
    const value = parseFloat(match[2]);
    if (!isNaN(value)) {
      const dimension = key === 'score' ? null : key.replace(/_score$/, '');
      scores.push({ value, max: 10, dimension });
    }
  }

  return scores;
}

// -----------------------------------------------------------------------------
// Policy Loading
// -----------------------------------------------------------------------------

function loadPolicy(): VerificationPolicy {
  const projectDir = getProjectDir();
  if (!projectDir || projectDir === '.') return {};

  const policyPath = join(projectDir, '.claude', 'policies', 'verification-policy.json');
  if (!existsSync(policyPath)) return {};

  try {
    return JSON.parse(readFileSync(policyPath, 'utf8')) as VerificationPolicy;
  } catch {
    logHook('subagent-quality-gate', 'Failed to parse verification-policy.json', 'warn');
    return {};
  }
}

function getThreshold(dimension: string | null, policy: VerificationPolicy): number {
  const thresholds: Record<string, number> = { ...DEFAULT_THRESHOLDS, ...policy.thresholds };

  if (dimension) {
    const dimKey = `${dimension}_minimum`;
    if (dimKey in thresholds) {
      return thresholds[dimKey] ?? DEFAULT_THRESHOLDS.general_minimum;
    }
    // Security-related dimensions use security threshold
    if (/security|vuln|cve|owasp/i.test(dimension)) {
      return thresholds.security_minimum ?? DEFAULT_THRESHOLDS.security_minimum;
    }
  }

  return thresholds.general_minimum ?? DEFAULT_THRESHOLDS.general_minimum;
}

// -----------------------------------------------------------------------------
// Structure Validation
// -----------------------------------------------------------------------------

/**
 * Check if the output contains structured evidence/findings.
 * Returns true if evidence is present or output is too short to expect structure.
 */
function hasStructuredOutput(text: string): boolean {
  if (!text || text.length < 200) return true; // Too short to expect structure

  const evidencePatterns = [
    /\bfinding/i,
    /\bevidence/i,
    /\brecommendation/i,
    /\bissue/i,
    /\bresult/i,
    /\bsummary/i,
    /^[-*]\s/m, // Bullet points
    /^\d+\.\s/m, // Numbered lists
    /^#{1,3}\s/m, // Markdown headers
  ];

  return evidencePatterns.some((p) => p.test(text));
}

// -----------------------------------------------------------------------------
// Metrics
// -----------------------------------------------------------------------------

interface Metrics {
  errors: number;
  quality_checks: number;
  threshold_failures: number;
  [key: string]: unknown;
}

function updateMetrics(type: 'error' | 'threshold_failure' | 'check'): void {
  if (!existsSync(METRICS_FILE)) return;

  try {
    const metrics: Metrics = JSON.parse(readFileSync(METRICS_FILE, 'utf8'));

    if (type === 'error') {
      metrics.errors = (metrics.errors || 0) + 1;
    } else if (type === 'threshold_failure') {
      metrics.threshold_failures = (metrics.threshold_failures || 0) + 1;
    }
    metrics.quality_checks = (metrics.quality_checks || 0) + 1;

    writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

/** Validates subagent output quality with score thresholds and structure checks. */
export function subagentQualityGate(input: HookInput): HookResult {
  const agentId = input.agent_id || '';
  const subagentType = input.subagent_type || '';
  const error = input.error || '';
  const outputText = input.agent_output || input.output || input.last_assistant_message || '';

  logHook('subagent-quality-gate', `Quality gate check: ${subagentType} (${agentId})`);

  // Gate 1: Error presence check (existing behavior)
  if (error && error !== 'null') {
    logHook('subagent-quality-gate', `ERROR: Subagent failed - ${error}`);
    updateMetrics('error');
    return outputWarning(`Subagent ${subagentType} failed: ${error}`);
  }

  // Gate 2: Score threshold validation
  const scores = extractScores(outputText);
  if (scores.length > 0) {
    const policy = loadPolicy();

    for (const score of scores) {
      const normalized = (score.value / score.max) * 10; // Normalize to 0-10 scale
      const threshold = getThreshold(score.dimension, policy);
      const label = score.dimension || 'overall';

      if (normalized < threshold) {
        logHook(
          'subagent-quality-gate',
          `Score below threshold: ${label}=${normalized.toFixed(1)}/10 (min: ${threshold})`,
          'warn',
        );
        updateMetrics('threshold_failure');
        return outputWarning(
          `Quality gate: ${label} score ${score.value}/${score.max} ` +
            `(${normalized.toFixed(1)}/10) is below minimum ${threshold}/10. ` +
            `Review the ${label} findings before proceeding.`,
        );
      }
    }
  }

  // Gate 3: Output structure validation (advisory only for long outputs)
  if (outputText.length > 200 && !hasStructuredOutput(outputText)) {
    logHook(
      'subagent-quality-gate',
      `Subagent ${subagentType} output lacks structured findings`,
      'info',
    );
    // Don't block — just warn. Missing structure is a quality signal, not a hard gate.
  }

  updateMetrics('check');
  return outputSilentSuccess();
}
