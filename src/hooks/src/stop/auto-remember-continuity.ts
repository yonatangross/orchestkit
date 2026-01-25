/**
 * Auto-Remember Continuity - Stop Hook
 * Prompts Claude to store session context before end
 *
 * Graph-First Architecture (v2.1):
 * - ALWAYS works - knowledge graph requires no configuration
 * - Primary: Store in knowledge graph (mcp__memory__*)
 * - Optional: Also sync to mem0 cloud if configured
 */

import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir } from '../lib/common.js';

/**
 * Generate stop prompt for session continuity
 */
export function autoRememberContinuity(input: HookInput): HookResult {
  logHook('auto-remember-continuity', 'Hook triggered');

  const projectDir = input.project_dir || getProjectDir();
  const projectId = projectDir.split('/').pop() || 'project';

  // Check if mem0 is available (by checking env var)
  const mem0Available = !!process.env.MEM0_API_KEY;
  const mem0Hint = mem0Available
    ? '\n   [Optional] Also sync to mem0 cloud with `--mem0` flag for semantic search'
    : '';

  const promptMsg = `Before ending this session, consider preserving important context in the knowledge graph:

1. **Session Continuity** - If there's unfinished work or next steps:
   \`mcp__memory__create_entities\` with:
   \`\`\`json
   {"entities": [{
     "name": "session-${projectId}",
     "entityType": "Session",
     "observations": ["What was done: [...]", "Next steps: [...]"]
   }]}
   \`\`\`${mem0Hint}

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
