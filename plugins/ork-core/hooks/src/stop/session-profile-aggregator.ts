/**
 * Session Profile Aggregator - Aggregate session data into user profile at session end
 *
 * Part of Intelligent Decision Capture System
 *
 * This hook runs at session end to:
 * 1. Generate session summary from events
 * 2. Aggregate into user profile (skills, agents, decisions)
 * 3. Save updated profile to disk
 * 4. Export generalizable decisions for global sharing (if enabled)
 *
 * CC 2.1.7 Compliant: Uses outputSilentSuccess for silent operation
 */

import type { HookInput, HookResult } from '../types.js';
import { logHook, outputSilentSuccess } from '../lib/common.js';
import { resolveUserIdentity, canShare, getPrivacySettings } from '../lib/user-identity.js';
import { generateSessionSummary, trackSessionEnd } from '../lib/session-tracker.js';
import {
  loadUserProfile,
  saveUserProfile,
  aggregateSession,
  exportForGlobal,
} from '../lib/user-profile.js';

/**
 * Aggregate session data into user profile
 */
export function sessionProfileAggregator(input: HookInput): HookResult {
  try {
    // Track session end event
    trackSessionEnd();

    // Get user identity
    const identity = resolveUserIdentity();
    logHook('session-profile-aggregator', `Aggregating session for ${identity.user_id}`, 'debug');

    // Generate session summary
    const summary = generateSessionSummary();

    // Skip if no meaningful activity
    if (
      summary.skills_used.length === 0 &&
      summary.agents_spawned.length === 0 &&
      summary.decisions_made === 0
    ) {
      logHook('session-profile-aggregator', 'No meaningful activity to aggregate', 'debug');
      return outputSilentSuccess();
    }

    // Load and update user profile
    const profile = loadUserProfile(identity.user_id);
    const updatedProfile = aggregateSession(profile, summary);

    // Save updated profile
    const saved = saveUserProfile(updatedProfile);
    if (!saved) {
      logHook('session-profile-aggregator', 'Failed to save profile', 'warn');
      return outputSilentSuccess();
    }

    logHook(
      'session-profile-aggregator',
      `Aggregated session: ${summary.skills_used.length} skills, ${summary.agents_spawned.length} agents, ${summary.decisions_made} decisions`,
      'info'
    );

    // Export for global sharing if privacy allows
    const privacy = getPrivacySettings();
    if (privacy.share_globally && canShare('decisions', 'global')) {
      const globalExport = exportForGlobal(updatedProfile);

      // Only export if there are decisions worth sharing
      const generalizableDecisions = globalExport.decisions.filter(
        d => d.confidence >= 0.8 && d.rationale
      );

      if (generalizableDecisions.length > 0) {
        logHook(
          'session-profile-aggregator',
          `${generalizableDecisions.length} decisions eligible for global sharing`,
          'info'
        );
        // Note: Actual export to mem0 happens via batch-sync.py or mem0-pre-compaction-sync
      }
    }

    return outputSilentSuccess();
  } catch (error) {
    logHook('session-profile-aggregator', `Error aggregating session: ${error}`, 'error');
    return outputSilentSuccess();
  }
}
