/**
 * First Run Setup - Full setup with optional interactive wizard
 * Hook: Setup (triggered by setup-check.sh)
 * CC 2.1.11 Compliant
 *
 * Phases:
 * 1. Environment detection
 * 2. Dependency validation
 * 3. Configuration selection
 * 4. Apply configuration
 * 5. Create marker file
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync, chmodSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getPluginRoot, outputWithContext, outputSilentSuccess } from '../lib/common.js';

const CURRENT_VERSION = '4.25.0';

interface EnvironmentInfo {
  python?: string;
  nodejs?: string;
  git?: boolean;
  docker?: boolean;
  sqlite3?: boolean;
  os: string;
}

interface PresetConfig {
  preset: string;
  description: string;
  features: {
    skills: boolean;
    agents: boolean;
    hooks: boolean;
    mcp: boolean;
    coordination: boolean;
    statusline: boolean;
  };
  hook_groups: {
    safety: boolean;
    quality: boolean;
    productivity: boolean;
    observability: boolean;
  };
}

/**
 * Detect environment
 */
function detectEnvironment(): EnvironmentInfo {
  logHook('first-run-setup', 'Phase 1: Detecting environment');

  const envInfo: EnvironmentInfo = {
    os: process.platform,
  };

  // Detect Python version
  try {
    const result = execSync('python3 --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const match = result.match(/(\d+\.\d+)/);
    if (match) {
      envInfo.python = match[1];
      logHook('first-run-setup', `Python: ${match[1]}`);
    }
  } catch {
    // Python not available
  }

  // Detect Node.js version
  try {
    const result = execSync('node --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const match = result.match(/(\d+\.\d+)/);
    if (match) {
      envInfo.nodejs = match[1];
      logHook('first-run-setup', `Node.js: ${match[1]}`);
    }
  } catch {
    // Node.js not available
  }

  // Detect Git
  try {
    execSync('which git', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    envInfo.git = true;
    logHook('first-run-setup', 'Git: available');
  } catch {
    // Git not available
  }

  // Detect Docker
  try {
    execSync('which docker', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    envInfo.docker = true;
    logHook('first-run-setup', 'Docker: available');
  } catch {
    // Docker not available
  }

  // Detect SQLite3
  try {
    execSync('which sqlite3', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    envInfo.sqlite3 = true;
    logHook('first-run-setup', 'SQLite3: available (multi-instance coordination enabled)');
  } catch {
    // SQLite3 not available
  }

  return envInfo;
}

/**
 * Validate dependencies
 */
function validateDependencies(): { valid: boolean; missing: string[]; warnings: string[] } {
  logHook('first-run-setup', 'Phase 2: Validating dependencies');

  const missing: string[] = [];
  const warnings: string[] = [];

  // Required: jq
  try {
    execSync('which jq', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    missing.push('jq (required for JSON processing)');
  }

  // Optional: sqlite3
  try {
    execSync('which sqlite3', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    warnings.push('sqlite3 not found - multi-instance coordination disabled');
  }

  // Optional: anthropic SDK
  try {
    execSync('python3 -c "import anthropic"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    logHook('first-run-setup', 'Anthropic SDK: available (Memory Fabric Agent enabled)');
  } catch {
    warnings.push('anthropic SDK not found - Memory Fabric Agent will use fallback mode');
    warnings.push("  Install with: pip install 'orchestkit[memory]'");
  }

  // Report
  if (missing.length > 0) {
    logHook('first-run-setup', 'ERROR: Missing required dependencies:');
    for (const dep of missing) {
      logHook('first-run-setup', `  - ${dep}`);
    }
  }

  for (const warn of warnings) {
    logHook('first-run-setup', `WARN: ${warn}`);
  }

  return { valid: missing.length === 0, missing, warnings };
}

/**
 * Get preset configuration
 */
function getPresetConfig(preset: string): PresetConfig {
  const configs: Record<string, PresetConfig> = {
    complete: {
      preset: 'complete',
      description: 'Full AI-assisted development toolkit',
      features: {
        skills: true,
        agents: true,
        hooks: true,
        mcp: true,
        coordination: true,
        statusline: true,
      },
      hook_groups: {
        safety: true,
        quality: true,
        productivity: true,
        observability: true,
      },
    },
    standard: {
      preset: 'standard',
      description: 'Skills and hooks without agent orchestration',
      features: {
        skills: true,
        agents: false,
        hooks: true,
        mcp: true,
        coordination: true,
        statusline: true,
      },
      hook_groups: {
        safety: true,
        quality: true,
        productivity: true,
        observability: true,
      },
    },
    lite: {
      preset: 'lite',
      description: 'Essential skills for constrained environments',
      features: {
        skills: true,
        agents: false,
        hooks: true,
        mcp: false,
        coordination: false,
        statusline: false,
      },
      hook_groups: {
        safety: true,
        quality: true,
        productivity: false,
        observability: false,
      },
    },
    'hooks-only': {
      preset: 'hooks-only',
      description: 'Safety hooks only for pure automation',
      features: {
        skills: false,
        agents: false,
        hooks: true,
        mcp: false,
        coordination: false,
        statusline: false,
      },
      hook_groups: {
        safety: true,
        quality: false,
        productivity: false,
        observability: false,
      },
    },
  };

  return configs[preset] || configs.complete;
}

/**
 * Apply configuration
 */
function applyConfiguration(preset: string, envInfo: EnvironmentInfo, pluginRoot: string): PresetConfig {
  logHook('first-run-setup', `Phase 4: Applying configuration (preset: ${preset})`);

  const config = getPresetConfig(preset);

  // Ensure directories exist
  const dirs = [
    `${pluginRoot}/.claude/defaults`,
    `${pluginRoot}/.claude/context/session`,
    `${pluginRoot}/.claude/context/knowledge`,
    `${pluginRoot}/.claude/logs`,
  ];

  for (const dir of dirs) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  // Write config if it doesn't exist
  const configFile = `${pluginRoot}/.claude/defaults/config.json`;
  if (!existsSync(configFile)) {
    writeFileSync(configFile, JSON.stringify(config, null, 2));
    logHook('first-run-setup', `Created config file: ${configFile}`);
  }

  // Make all hooks executable
  try {
    const hooksDir = `${pluginRoot}/hooks`;
    if (existsSync(hooksDir)) {
      const makeExecutable = (dir: string) => {
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${dir}/${entry.name}`;
            if (entry.isDirectory()) {
              makeExecutable(fullPath);
            } else if (entry.name.endsWith('.sh')) {
              try {
                chmodSync(fullPath, 0o755);
              } catch {
                // Ignore chmod errors
              }
            }
          }
        } catch {
          // Ignore directory errors
        }
      };
      makeExecutable(hooksDir);
      logHook('first-run-setup', 'Made hooks executable');
    }
  } catch {
    // Ignore
  }

  return config;
}

/**
 * Create marker file
 */
function createMarker(preset: string, envInfo: EnvironmentInfo, pluginRoot: string): void {
  logHook('first-run-setup', 'Phase 5: Creating marker file');

  const now = new Date().toISOString();

  // Count components
  let hookCount = 0;
  let skillCount = 0;
  let agentCount = 0;

  try {
    const countFiles = (dir: string, pattern: RegExp): number => {
      let count = 0;
      const walk = (d: string) => {
        try {
          const entries = readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${d}/${entry.name}`;
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (pattern.test(entry.name)) {
              count++;
            }
          }
        } catch {
          // Ignore
        }
      };
      walk(dir);
      return count;
    };

    hookCount = countFiles(`${pluginRoot}/hooks`, /\.sh$/);
    skillCount = countFiles(`${pluginRoot}/skills`, /SKILL\.md$/);
    agentCount = countFiles(`${pluginRoot}/agents`, /\.md$/);
  } catch {
    // Ignore count errors
  }

  const marker = {
    version: CURRENT_VERSION,
    setup_date: now,
    preset,
    components: {
      hooks: { count: hookCount, valid: true },
      skills: { count: skillCount, valid: true },
      agents: { count: agentCount, valid: true },
    },
    last_health_check: now,
    last_maintenance: now,
    environment: envInfo,
    user_preferences: {
      onboarding_completed: true,
      mcp_configured: false,
      statusline_configured: false,
    },
  };

  const markerFile = `${pluginRoot}/.setup-complete`;
  writeFileSync(markerFile, JSON.stringify(marker, null, 2));
  logHook('first-run-setup', `Marker file created: ${markerFile}`);
}

/**
 * First run setup hook
 */
export function firstRunSetup(input: HookInput): HookResult {
  const pluginRoot = getPluginRoot();
  const mode = process.argv.includes('--silent') ? 'silent' : 'interactive';

  logHook('first-run-setup', `First-run setup starting (mode: ${mode})`);

  // Phase 1: Environment detection
  const envInfo = detectEnvironment();

  // Phase 2: Dependency validation
  const { valid, missing } = validateDependencies();
  if (!valid) {
    logHook('first-run-setup', 'ERROR: Dependency validation failed');
    const ctx = `OrchestKit setup failed: Missing required dependencies. Install ${missing.join(', ')}.`;
    return outputWithContext(ctx);
  }

  // Phase 3: Select preset (default to complete)
  const preset = 'complete';
  if (mode === 'interactive') {
    logHook('first-run-setup', 'Interactive mode - using complete preset (wizard via Claude conversation)');
  } else {
    logHook('first-run-setup', 'Silent mode - using complete preset');
  }

  // Phase 4: Apply configuration
  applyConfiguration(preset, envInfo, pluginRoot);

  // Phase 5: Create marker
  createMarker(preset, envInfo, pluginRoot);

  // Count components for success message
  let hookCount = 0;
  let skillCount = 0;
  let agentCount = 0;
  try {
    const countFiles = (dir: string, pattern: RegExp): number => {
      let count = 0;
      const walk = (d: string) => {
        try {
          const entries = readdirSync(d, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = `${d}/${entry.name}`;
            if (entry.isDirectory()) {
              walk(fullPath);
            } else if (pattern.test(entry.name)) {
              count++;
            }
          }
        } catch {
          // Ignore
        }
      };
      walk(dir);
      return count;
    };

    hookCount = countFiles(`${pluginRoot}/hooks`, /\.sh$/);
    skillCount = countFiles(`${pluginRoot}/skills`, /SKILL\.md$/);
    agentCount = countFiles(`${pluginRoot}/agents`, /\.md$/);
  } catch {
    // Ignore count errors
  }

  logHook('first-run-setup', `Setup complete: ${skillCount} skills, ${agentCount} agents, ${hookCount} hooks`);

  const ctx =
    mode === 'interactive'
      ? `OrchestKit v${CURRENT_VERSION} setup complete! Loaded ${skillCount} skills, ${agentCount} agents, and ${hookCount} hooks. Use /ork:configure to customize settings.`
      : `OrchestKit v${CURRENT_VERSION} initialized (silent mode).`;

  return outputWithContext(ctx);
}
