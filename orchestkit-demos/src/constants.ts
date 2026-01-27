// src/constants.ts
// Centralized constants for OrchestKit demo videos

/**
 * OrchestKit stats - single source of truth
 * Update these values when OrchestKit versions change
 */
export const ORCHESTKIT_STATS = {
  skills: 181,
  agents: 35,
  hooks: 152,
  ccVersion: "CC 2.1.20",
  // Uppercase aliases for backward compatibility
  SKILLS: 181,
  AGENTS: 35,
  HOOKS: 152,
} as const;

/**
 * Video configuration defaults
 */
export const VIDEO_CONFIG = {
  fps: 30,
  width: 1920,
  height: 1080,
  verticalWidth: 1080,
  verticalHeight: 1920,
} as const;

/**
 * Color palette
 */
export const COLORS = {
  primary: "#8b5cf6",
  secondary: "#22c55e",
  accent: "#06b6d4",
  warning: "#f59e0b",
  error: "#ef4444",
  pink: "#ec4899",
  orange: "#f97316",
  background: "#0a0a0f",
  surface: "#1a1a2e",
} as const;
