/**
 * Hook registration for lesson-cards.
 *
 * Events:
 * - session.start: Load corpus (patterns + bullets)
 * - tool.call{tool=Bash}: Match command, return context
 * - tool.call{tool=Edit}: Match file/content, return context
 * - tool.call{tool=Write}: Match file/content, return context
 * - ui.render{component=ToolUse}: Append card under tool row
 * - command.register: /lessons reload command
 */

import { loadCorpus, type Corpus } from '../src/corpus.js';
import { matchBashCommand, matchFileEdit, matchAll } from '../src/match.js';
import { buildCard, formatContext } from '../src/card.js';
import type { MatchedLesson } from '../src/types.js';

// Module-scope state (per session)
let corpus: Corpus | null = null;
const matchMap = new Map<string, MatchedLesson[]>();

export const hooks = {
  'session.start': async ($: unknown) => {
    corpus = await loadCorpus($ as never);
    matchMap.clear();
  },

  'tool.call': async ($: unknown, event: { tool: string; args: Record<string, unknown>; tool_use_id?: string }) => {
    const typed$ = $ as {
      ui?: { notice?: (id: string, msg: string) => Promise<void>; invalidate?: (c: string) => Promise<void> };
    };
    const { tool, args, tool_use_id } = event;
    const requestId = tool_use_id || `tool-${Date.now()}`;

    // Get next function from context if available
    const next = (event as { next?: (e: unknown) => Promise<unknown> }).next;

    // First, let the tool execute
    const result = next ? await next(event) : {};

    if (!corpus) {
      return result;
    }

    let matches: MatchedLesson[] = [];

    if (tool === 'Bash') {
      const command = String(args.command || '');
      if (command) {
        matches = matchAll(command, corpus.patterns, corpus.bullets);
      }
    } else if (tool === 'Edit') {
      const filePath = String(args.file_path || '');
      const newContent = String(args.new_content || args.content || '');
      if (filePath) {
        matches = matchFileEdit(filePath, newContent, corpus.patterns);
      }
    } else if (tool === 'Write') {
      const filePath = String(args.file_path || '');
      const content = String(args.content || '');
      if (filePath) {
        matches = matchFileEdit(filePath, content, corpus.patterns);
      }
    }

    // Store matches for ui.render
    if (matches.length > 0) {
      matchMap.set(requestId, matches);

      // Try to show notice during permission dialog (only works if dialog is open)
      try {
        await typed$?.ui?.notice?.(requestId, `lesson: ${matches[0].id}`);
      } catch {
        // Notice refused - dialog not open, ignore
      }
    }

    // Add context for model
    if (matches.length > 0) {
      const context = formatContext(matches[0]);
      return { ...result, context: [context] };
    }

    return result;
  },

  'ui.render': async ($: unknown, event: { component: string; requestId?: string }) => {
    const typed$ = $ as {
      ui?: { invalidate?: (c: string) => Promise<void> };
    };
    const { component, requestId } = event;
    const next = (event as { next?: (e: unknown) => Promise<unknown> }).next;

    if (component !== 'ToolUse') {
      return next ? await next(event) : {};
    }

    // Get the rendered tree
    const tree = next ? await next(event) : {};

    if (!requestId || !matchMap.has(requestId)) {
      return tree;
    }

    const matches = matchMap.get(requestId);
    if (!matches || matches.length === 0) {
      return tree;
    }

    // Append card under the tool row
    const card = buildCard(matches[0], requestId);

    // Add card to tree children
    const treeWithCard = tree as { children?: unknown[] };
    if (!treeWithCard.children) {
      treeWithCard.children = [];
    }
    (treeWithCard.children as unknown[]).push(card);

    return tree;
  },

  'command.register': async ($: unknown, event: { command: string }) => {
    const typed$ = $ as {
      ui?: { invalidate?: (c: string) => Promise<void> };
    };

    if (event.command === '/lessons') {
      // Reload corpus
      corpus = await loadCorpus($ as never);
      matchMap.clear();
      // Invalidate UI to show updated state
      try {
        await typed$?.ui?.invalidate?.('ui.render');
      } catch {
        // Ignore if invalidate fails
      }
      return { message: 'Lessons reloaded' };
    }
    return {};
  },
};

export default hooks;
