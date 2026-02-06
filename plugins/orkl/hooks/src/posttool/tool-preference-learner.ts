/**
 * Tool Preference Learner Hook - Learn user's tool usage patterns
 *
 * Part of Intelligent Decision Capture System
 * Hook: PostToolUse
 *
 * Purpose:
 * - Track which tools are used for different tasks
 * - Learn preferences like "prefers Grep over Bash find"
 * - Identify tool usage patterns per category
 * - Store preferences for future suggestions
 *
 * Categories:
 * - file_search: Glob, Grep, Bash find
 * - code_reading: Read, Bash cat/head
 * - testing: Bash npm test, pytest, jest
 * - git: Bash git, Skill commit
 *
 * CC 2.1.16 Compliant
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  getField,
  getProjectDir,
  logHook,
} from '../lib/common.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'tool-preference-learner';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tool category for grouping similar operations
 */
export type ToolCategory =
  | 'file_search'
  | 'content_search'
  | 'code_reading'
  | 'code_writing'
  | 'testing'
  | 'building'
  | 'git_operations'
  | 'agent_spawn'
  | 'other';

/**
 * Learned tool preference
 */
export interface ToolPreference {
  /** Category of operation */
  category: ToolCategory;
  /** Preferred tool for this category */
  preferred_tool: string;
  /** Confidence in this preference */
  confidence: number;
  /** Number of times this tool was used */
  sample_count: number;
  /** Last updated timestamp */
  updated_at: string;
}

/**
 * Usage counts for tools in a category
 */
interface CategoryUsage {
  [tool: string]: number;
}

/**
 * All preferences data
 */
interface PreferencesData {
  /** Usage counts per category */
  usage: Record<ToolCategory, CategoryUsage>;
  /** Derived preferences */
  preferences: Record<ToolCategory, ToolPreference | null>;
  /** Last update timestamp */
  updated_at: string;
}

// =============================================================================
// TOOL CATEGORIZATION
// =============================================================================

/**
 * Tool category mappings
 */
const TOOL_CATEGORIES: Record<string, ToolCategory[]> = {
  // File search tools
  'Glob': ['file_search'],
  'Bash:find': ['file_search'],
  'Bash:ls': ['file_search'],

  // Content search tools
  'Grep': ['content_search'],
  'Bash:grep': ['content_search'],
  'Bash:rg': ['content_search'],
  'Bash:ag': ['content_search'],

  // Code reading tools
  'Read': ['code_reading'],
  'Bash:cat': ['code_reading'],
  'Bash:head': ['code_reading'],
  'Bash:tail': ['code_reading'],

  // Code writing tools
  'Write': ['code_writing'],
  'Edit': ['code_writing'],
  'MultiEdit': ['code_writing'],
  'NotebookEdit': ['code_writing'],

  // Testing tools
  'Bash:test': ['testing'],
  'Bash:pytest': ['testing'],
  'Bash:jest': ['testing'],
  'Bash:vitest': ['testing'],
  'Bash:npm_test': ['testing'],

  // Building tools
  'Bash:build': ['building'],
  'Bash:npm_run_build': ['building'],
  'Bash:make': ['building'],
  'Bash:cargo_build': ['building'],
  'Bash:tsc': ['building'],

  // Git operations
  'Bash:git': ['git_operations'],
  'Bash:gh': ['git_operations'],
  'Skill:commit': ['git_operations'],
  'Skill:create-pr': ['git_operations'],

  // Agent operations
  'Task': ['agent_spawn'],
};

/**
 * Patterns to identify Bash sub-tools
 */
const BASH_PATTERNS: [RegExp, string][] = [
  [/\bfind\s+/, 'Bash:find'],
  [/\bls\s+/, 'Bash:ls'],
  [/\bgrep\s+/, 'Bash:grep'],
  [/\brg\s+/, 'Bash:rg'],
  [/\bag\s+/, 'Bash:ag'],
  [/\bcat\s+/, 'Bash:cat'],
  [/\bhead\s+/, 'Bash:head'],
  [/\btail\s+/, 'Bash:tail'],
  [/\bpytest\b/, 'Bash:pytest'],
  [/\bjest\b/, 'Bash:jest'],
  [/\bvitest\b/, 'Bash:vitest'],
  [/\bnpm\s+test\b/, 'Bash:npm_test'],
  [/\bnpm\s+run\s+build\b/, 'Bash:npm_run_build'],
  [/\bmake\b/, 'Bash:make'],
  [/\bcargo\s+build\b/, 'Bash:cargo_build'],
  [/\btsc\b/, 'Bash:tsc'],
  [/\bgit\s+/, 'Bash:git'],
  [/\bgh\s+/, 'Bash:gh'],
];

/**
 * Get specific tool identifier for a Bash command
 */
function identifyBashTool(command: string): string {
  for (const [pattern, toolId] of BASH_PATTERNS) {
    if (pattern.test(command)) {
      return toolId;
    }
  }
  return 'Bash:other';
}

/**
 * Get tool identifier for categorization
 */
function getToolIdentifier(tool: string, command?: string, skill?: string): string {
  if (tool === 'Bash' && command) {
    return identifyBashTool(command);
  }

  if (tool === 'Skill' && skill) {
    return `Skill:${skill}`;
  }

  return tool;
}

/**
 * Get categories for a tool
 */
function getToolCategories(toolId: string): ToolCategory[] {
  return TOOL_CATEGORIES[toolId] || ['other'];
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Get path to preferences file
 */
function getPreferencesPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'tool-preferences.json');
}

/**
 * Load preferences data
 */
function loadPreferences(): PreferencesData {
  const filePath = getPreferencesPath();

  if (!existsSync(filePath)) {
    return createEmptyPreferences();
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as PreferencesData;
  } catch {
    return createEmptyPreferences();
  }
}

/**
 * Save preferences data
 */
function savePreferences(data: PreferencesData): boolean {
  const filePath = getPreferencesPath();

  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    logHook(HOOK_NAME, `Failed to save preferences: ${err}`, 'warn');
    return false;
  }
}

/**
 * Create empty preferences structure
 */
function createEmptyPreferences(): PreferencesData {
  const categories: ToolCategory[] = [
    'file_search', 'content_search', 'code_reading', 'code_writing',
    'testing', 'building', 'git_operations', 'agent_spawn', 'other',
  ];

  const usage: Record<ToolCategory, CategoryUsage> = {} as Record<ToolCategory, CategoryUsage>;
  const preferences: Record<ToolCategory, ToolPreference | null> = {} as Record<ToolCategory, ToolPreference | null>;

  for (const cat of categories) {
    usage[cat] = {};
    preferences[cat] = null;
  }

  return {
    usage,
    preferences,
    updated_at: new Date().toISOString(),
  };
}

// =============================================================================
// PREFERENCE CALCULATION
// =============================================================================

/**
 * Calculate preference from usage counts
 */
function calculatePreference(
  category: ToolCategory,
  usage: CategoryUsage
): ToolPreference | null {
  const tools = Object.entries(usage);

  if (tools.length === 0) {
    return null;
  }

  // Sort by count descending
  tools.sort((a, b) => b[1] - a[1]);

  const [preferredTool, count] = tools[0];
  const totalCount = tools.reduce((sum, [, c]) => sum + c, 0);

  // Calculate confidence based on:
  // 1. Sample size (more samples = higher confidence)
  // 2. Dominance (how much more preferred tool is used vs others)
  const sampleConfidence = Math.min(1, count / 10); // Max at 10 samples
  const dominance = count / totalCount;
  const confidence = (sampleConfidence * 0.4 + dominance * 0.6);

  // Only return preference if confidence is reasonable
  if (confidence < 0.3 || count < 2) {
    return null;
  }

  return {
    category,
    preferred_tool: preferredTool,
    confidence,
    sample_count: count,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update all preferences from usage data
 */
function updateAllPreferences(data: PreferencesData): void {
  const categories = Object.keys(data.usage) as ToolCategory[];

  for (const category of categories) {
    data.preferences[category] = calculatePreference(category, data.usage[category]);
  }

  data.updated_at = new Date().toISOString();
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Track tool usage for preference learning
 */
export function toolPreferenceLearner(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Skip if no tool name
  if (!toolName) {
    return outputSilentSuccess();
  }

  // Get command for Bash tool
  const command = getField<string>(input, 'tool_input.command');
  const skill = getField<string>(input, 'tool_input.skill');

  // Get tool identifier and categories
  const toolId = getToolIdentifier(toolName, command, skill);
  const categories = getToolCategories(toolId);

  // Skip 'other' category to avoid noise
  const relevantCategories = categories.filter(c => c !== 'other');
  if (relevantCategories.length === 0) {
    return outputSilentSuccess();
  }

  // Load and update preferences
  const data = loadPreferences();

  for (const category of relevantCategories) {
    if (!data.usage[category]) {
      data.usage[category] = {};
    }
    data.usage[category][toolId] = (data.usage[category][toolId] || 0) + 1;
  }

  // Recalculate preferences
  updateAllPreferences(data);

  // Save
  savePreferences(data);

  // Log significant preference changes
  for (const category of relevantCategories) {
    const pref = data.preferences[category];
    if (pref && pref.confidence > 0.7 && pref.sample_count === 10) {
      logHook(
        HOOK_NAME,
        `Strong preference detected: ${category} → ${pref.preferred_tool} (${(pref.confidence * 100).toFixed(0)}%)`,
        'info'
      );
    }
  }

  return outputSilentSuccess();
}

// =============================================================================
// EXPORTS FOR OTHER HOOKS
// =============================================================================

/**
 * Get preferred tool for a category
 */
export function getPreferredTool(category: ToolCategory): ToolPreference | null {
  const data = loadPreferences();
  return data.preferences[category] || null;
}

/**
 * Get all preferences
 */
export function getAllPreferences(): Record<ToolCategory, ToolPreference | null> {
  const data = loadPreferences();
  return data.preferences;
}
