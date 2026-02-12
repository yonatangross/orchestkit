/**
 * Auto-Remember Continuity - Stop Hook
 * Prompts Claude to store session context before end
 *
 * Graph-First Architecture (v2.1):
 * - ALWAYS works - knowledge graph requires no configuration
 * - Primary: Store in knowledge graph (mcp__memory__*)
 */

import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir } from '../lib/common.js';
import { basename } from 'node:path';

/**
 * Generate stop prompt for session continuity
 */
export function autoRememberContinuity(input: HookInput): HookResult {
  logHook('auto-remember-continuity', 'Hook triggered');

  const projectDir = input.project_dir || getProjectDir();
  const projectId = basename(projectDir) || 'project';

  const promptMsg = `Before ending this session, consider preserving important context in the knowledge graph:

1. **Session Continuity** - If there's unfinished work or next steps:
   \`mcp__memory__create_entities\` with:
   \`\`\`json
   {"entities": [{
     "name": "session-${projectId}",
     "entityType": "Session",
     "observations": ["What was done: [...]", "Next steps: [...]"]
   }]}
   \`\`\`

2. **Important Decisions** - If architectural/design decisions were made:
   \`mcp__memory__create_entities\` with:
   \`\`\`json
   {"entities": [{
     "name": "decision-[topic]",
     "entityType": "Decision",
     "observations": ["Decided: [...]", "Rationale: [...]"]
   }]}
   \`\`\`

3. **Patterns Learned** - If something worked well or failed:
   - Use \`/remember --success "pattern that worked"\`
   - Use \`/remember --failed "pattern that caused issues"\`

Skip if this was just a quick question/answer session.`;

  logHook('auto-remember-continuity', 'Outputting memory prompt for session end');

  return {
    continue: true,
    suppressOutput: true,
    // Note: stopPrompt is handled by the CC runtime, we just return continue: true
  };
}
