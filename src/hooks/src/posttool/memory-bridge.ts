/**
 * Memory Bridge Hook - Graph-First Memory Sync
 * Triggers on PostToolUse for mcp__memory__create_entities
 *
 * Graph-First Architecture (v3.0):
 * - Graph (mcp__memory__*) is AUTHORITATIVE — always the source of truth
 * - When graph is used (default), NO sync needed (already in primary)
 * - Entity extraction logic removed in v7.27.1 (#1145) — was dead code
 *   since Graph-First v3.0 made secondary sync unnecessary
 *
 * Version: 3.1.0 - Cleaned dead code per #1145
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

/**
 * Sync memory operations (Graph-First Architecture)
 * Only graph operations trigger this hook
 */
export function memoryBridge(input: HookInput, ctx?: HookContext): HookResult {
  const toolName = input.tool_name || '';

  switch (toolName) {
    case 'mcp__memory__create_entities':
      // Graph-First: No sync needed when writing to graph (it's already the primary)
      (ctx?.log ?? logHook)('memory-bridge', 'mcp__memory__create_entities - graph is primary, no sync needed');
      return outputSilentSuccess();

    default:
      return outputSilentSuccess();
  }
}
