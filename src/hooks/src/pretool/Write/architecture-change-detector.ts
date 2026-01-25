/**
 * Architecture Change Detector Hook
 * Detects breaking architectural changes and injects guidelines
 * CC 2.1.9 Enhanced: Injects architectural guidelines as additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { guardPathPattern } from '../../lib/guards.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Architectural layer definitions
 */
type ArchLayer = 'api-layer' | 'service-layer' | 'data-layer' | 'workflow-layer' | 'unknown';

/**
 * Path patterns for architectural layers
 */
const LAYER_PATTERNS: Record<ArchLayer, RegExp[]> = {
  'api-layer': [/\/api\//, /\/routes\//, /\/endpoints\//],
  'service-layer': [/\/services\//],
  'data-layer': [/\/db\//, /\/models\//, /\/repositories\//],
  'workflow-layer': [/\/workflows\//, /\/agents\//],
  unknown: [],
};

/**
 * Determine architectural layer from file path
 */
function detectArchLayer(filePath: string): ArchLayer {
  for (const [layer, patterns] of Object.entries(LAYER_PATTERNS)) {
    if (layer === 'unknown') continue;
    if (patterns.some((p) => p.test(filePath))) {
      return layer as ArchLayer;
    }
  }
  return 'unknown';
}

/**
 * Load pattern hints from project patterns directory
 */
function loadPatternHints(layer: ArchLayer, projectDir: string): string {
  const patternsDir = join(projectDir, '.claude', 'context', 'patterns');
  const layerPatternFile = join(patternsDir, `${layer}.json`);

  try {
    if (existsSync(layerPatternFile)) {
      const content = readFileSync(layerPatternFile, 'utf8');
      const patterns = JSON.parse(content);
      const count = Array.isArray(patterns) ? patterns.length : Object.keys(patterns).length;
      if (count > 0) {
        return ` | Patterns loaded: ${count}`;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return '';
}

/**
 * Detect architectural changes and inject context
 */
export function architectureChangeDetector(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const projectDir = input.project_dir || getProjectDir();

  if (!filePath) {
    return outputSilentSuccess();
  }

  // Self-guard: Only run for architectural paths
  const archPatterns = [
    '**/api/**',
    '**/services/**',
    '**/db/**',
    '**/models/**',
    '**/workflows/**',
  ];
  const guardResult = guardPathPattern(input, ...archPatterns);
  if (guardResult !== null) {
    return guardResult;
  }

  // Determine architectural layer
  const archLayer = detectArchLayer(filePath);

  if (archLayer === 'unknown') {
    return outputSilentSuccess();
  }

  // Load pattern hints
  const patternHints = loadPatternHints(archLayer, projectDir);

  // Check if file exists (new file vs modification)
  const isNewFile = !existsSync(filePath);

  // Build architecture context
  let archContext: string;
  if (isNewFile) {
    archContext = `New ${archLayer} file. Follow layer conventions: dependency injection, interface contracts${patternHints}`;
  } else {
    archContext = `Modifying ${archLayer}. Ensure: no breaking API changes, maintain layer boundaries${patternHints}`;
  }

  logPermissionFeedback('allow', `Architectural change: ${filePath} (${archLayer})`, input);
  logHook('architecture-change-detector', `ARCH_DETECT: ${filePath} (layer=${archLayer})`);

  // CC 2.1.9: Inject context
  return outputWithContext(archContext);
}
