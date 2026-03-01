/**
 * NotebookLM MCP Advisor Hook
 * Advisory warnings for destructive NotebookLM operations
 * Non-blocking — never uses outputBlock() or outputDeny()
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWarning,
  logHook,
} from '../../lib/common.js';

const HOOK_NAME = 'notebooklm-advisor';

/** Destructive / sensitive operations — emit warnings */
const WARN_OPS: Record<string, string> = {
  notebook_delete: 'Irreversible: all notebook content will be permanently deleted',
  source_delete: 'Irreversible: source content will be permanently lost',
  studio_delete: 'Irreversible: generated artifact will be permanently lost',
  notebook_share_public: 'This makes the notebook publicly accessible via link',
  notebook_share_invite: 'This sends an email invitation to the collaborator',
};

/**
 * NotebookLM advisor - warns about destructive and slow operations
 */
export function notebooklmAdvisor(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  if (!toolName.startsWith('mcp__notebooklm-mcp__')) {
    return outputSilentSuccess();
  }

  const op = toolName.replace('mcp__notebooklm-mcp__', '');

  // Destructive / sensitive operations — warnings
  if (WARN_OPS[op]) {
    logHook(HOOK_NAME, `WARN: ${op}`);
    return outputWarning(WARN_OPS[op]);
  }

  // Large source warning
  if (op === 'source_add') {
    const text = input.tool_input?.text;
    if (typeof text === 'string' && text.length > 50000) {
      logHook(HOOK_NAME, `WARN: source_add large text (${text.length} chars)`);
      return outputWarning(
        `Source is large (${text.length} chars). Consider splitting into multiple sources for better retrieval.`
      );
    }
  }

  // Note delete warning
  if (op === 'note' && input.tool_input?.action === 'delete') {
    logHook(HOOK_NAME, `WARN: note delete (irreversible)`);
    return outputWarning('Irreversible: note will be permanently deleted');
  }

  return outputSilentSuccess();
}
