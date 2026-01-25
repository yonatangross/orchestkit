/**
 * Calibration Engine - Outcome-based learning for intent classification
 * Issue #197: Agent Orchestration Layer
 *
 * Learns from agent dispatch outcomes to improve classification accuracy:
 * - Records dispatch-outcome pairs
 * - Calculates keyword-agent boost/penalty adjustments
 * - Provides calibration data for intent classifier
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getProjectDir, getSessionId, logHook } from './common.js';
import type {
  CalibrationRecord,
  CalibrationAdjustment,
  CalibrationData,
  AgentOutcome,
} from './orchestration-types.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum records to keep in calibration data */
const MAX_RECORDS = 500;

/** Minimum samples needed before applying adjustments */
const MIN_SAMPLES_FOR_ADJUSTMENT = 3;

/** Maximum adjustment magnitude */
const MAX_ADJUSTMENT = 15;

/** Adjustment step per outcome */
const ADJUSTMENT_STEP = 3;

/** Decay factor for old records (applied to adjustments) */
const DECAY_FACTOR = 0.9;

// -----------------------------------------------------------------------------
// File Management
// -----------------------------------------------------------------------------

function getCalibrationFile(): string {
  return `${getProjectDir()}/.claude/feedback/calibration-data.json`;
}

function ensureDir(): void {
  const dir = `${getProjectDir()}/.claude/feedback`;
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }
}

/**
 * Load calibration data from file
 */
export function loadCalibrationData(): CalibrationData {
  const file = getCalibrationFile();

  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      logHook('calibration-engine', 'Failed to load calibration data, using defaults');
    }
  }

  return {
    schemaVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    records: [],
    adjustments: [],
    stats: {
      totalDispatches: 0,
      successRate: 0,
      avgConfidence: 0,
      topAgents: [],
    },
  };
}

/**
 * Save calibration data to file
 */
export function saveCalibrationData(data: CalibrationData): void {
  ensureDir();
  const file = getCalibrationFile();

  data.updatedAt = new Date().toISOString();

  try {
    writeFileSync(file, JSON.stringify(data, null, 2));
    logHook('calibration-engine', 'Saved calibration data');
  } catch (err) {
    logHook('calibration-engine', `Failed to save calibration data: ${err}`);
  }
}

// -----------------------------------------------------------------------------
// Recording
// -----------------------------------------------------------------------------

/**
 * Create a hash of prompt for deduplication
 */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt.toLowerCase().trim()).digest('hex').slice(0, 16);
}

/**
 * Record a dispatch outcome
 */
export function recordOutcome(
  prompt: string,
  agent: string,
  matchedKeywords: string[],
  confidence: number,
  outcome: AgentOutcome,
  durationMs?: number,
  feedback?: 'positive' | 'negative' | 'neutral'
): void {
  const data = loadCalibrationData();

  const record: CalibrationRecord = {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    agent,
    promptHash: hashPrompt(prompt),
    matchedKeywords,
    dispatchConfidence: confidence,
    outcome,
    durationMs,
    feedback,
  };

  data.records.push(record);

  // Trim old records
  if (data.records.length > MAX_RECORDS) {
    data.records = data.records.slice(-MAX_RECORDS);
  }

  // Update adjustments
  updateAdjustments(data, record);

  // Update stats
  updateStats(data);

  saveCalibrationData(data);

  logHook(
    'calibration-engine',
    `Recorded outcome: ${agent} -> ${outcome} (conf: ${confidence})`
  );
}

// -----------------------------------------------------------------------------
// Adjustment Calculation
// -----------------------------------------------------------------------------

/**
 * Update adjustments based on new record
 */
function updateAdjustments(data: CalibrationData, record: CalibrationRecord): void {
  const isPositive = record.outcome === 'success';
  const isNegative = record.outcome === 'failure' || record.outcome === 'rejected';

  if (!isPositive && !isNegative) {
    // Partial outcomes don't affect adjustments
    return;
  }

  const adjustmentDelta = isPositive ? ADJUSTMENT_STEP : -ADJUSTMENT_STEP;

  for (const keyword of record.matchedKeywords) {
    const existing = data.adjustments.find(
      a => a.keyword === keyword && a.agent === record.agent
    );

    if (existing) {
      // Update existing adjustment
      existing.adjustment = Math.max(
        -MAX_ADJUSTMENT,
        Math.min(MAX_ADJUSTMENT, existing.adjustment + adjustmentDelta)
      );
      existing.sampleCount++;
      existing.lastUpdated = new Date().toISOString();
    } else {
      // Create new adjustment
      data.adjustments.push({
        keyword,
        agent: record.agent,
        adjustment: adjustmentDelta,
        sampleCount: 1,
        lastUpdated: new Date().toISOString(),
      });
    }
  }
}

/**
 * Apply decay to old adjustments
 */
export function applyDecay(data: CalibrationData): void {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const adj of data.adjustments) {
    const age = now - new Date(adj.lastUpdated).getTime();
    const daysOld = Math.floor(age / dayMs);

    if (daysOld > 7) {
      // Apply decay for adjustments older than 7 days
      adj.adjustment = Math.round(adj.adjustment * DECAY_FACTOR);

      // Remove zero adjustments
      if (Math.abs(adj.adjustment) < 1) {
        adj.adjustment = 0;
      }
    }
  }

  // Remove zero adjustments
  data.adjustments = data.adjustments.filter(a => a.adjustment !== 0);
}

// -----------------------------------------------------------------------------
// Statistics
// -----------------------------------------------------------------------------

/**
 * Update aggregate statistics
 */
function updateStats(data: CalibrationData): void {
  const records = data.records;
  if (records.length === 0) return;

  // Total dispatches
  data.stats.totalDispatches = records.length;

  // Success rate
  const successful = records.filter(r => r.outcome === 'success').length;
  data.stats.successRate = successful / records.length;

  // Average confidence
  const avgConf = records.reduce((sum, r) => sum + r.dispatchConfidence, 0) / records.length;
  data.stats.avgConfidence = Math.round(avgConf);

  // Top agents by count and success rate
  const agentStats = new Map<string, { count: number; success: number }>();
  for (const record of records) {
    const stat = agentStats.get(record.agent) || { count: 0, success: 0 };
    stat.count++;
    if (record.outcome === 'success') stat.success++;
    agentStats.set(record.agent, stat);
  }

  data.stats.topAgents = Array.from(agentStats.entries())
    .map(([agent, stat]) => ({
      agent,
      count: stat.count,
      successRate: stat.success / stat.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// -----------------------------------------------------------------------------
// Query Functions
// -----------------------------------------------------------------------------

/**
 * Get adjustments for intent classifier
 */
export function getAdjustments(): CalibrationAdjustment[] {
  const data = loadCalibrationData();

  // Only return adjustments with sufficient samples
  return data.adjustments.filter(a => a.sampleCount >= MIN_SAMPLES_FOR_ADJUSTMENT);
}

/**
 * Get success rate for a specific agent
 */
export function getAgentSuccessRate(agent: string): number | null {
  const data = loadCalibrationData();
  const agentRecords = data.records.filter(r => r.agent === agent);

  if (agentRecords.length < MIN_SAMPLES_FOR_ADJUSTMENT) {
    return null;
  }

  const successful = agentRecords.filter(r => r.outcome === 'success').length;
  return successful / agentRecords.length;
}

/**
 * Get calibration stats
 */
export function getCalibrationStats(): CalibrationData['stats'] {
  return loadCalibrationData().stats;
}

/**
 * Check if we have enough data for meaningful calibration
 */
export function hasMinimalCalibrationData(): boolean {
  const data = loadCalibrationData();
  return data.records.length >= MIN_SAMPLES_FOR_ADJUSTMENT;
}
