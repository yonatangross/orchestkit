/**
 * Docs tools — read-only documentation search + Markdown fetch, proxying the
 * public OrchestKit docs API (no auth). Mirrors the tool surface of the remote
 * Streamable HTTP server at https://orchestkit.yonyon.ai/api/mcp.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DOCS_ORIGIN = process.env.ORCHESTKIT_DOCS_ORIGIN ?? 'https://orchestkit.yonyon.ai';

type ToolText = { content: Array<{ type: 'text'; text: string }> };

function text(value: string): ToolText {
  return { content: [{ type: 'text' as const, text: value }] };
}

async function fetchText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: accept } });
  if (!res.ok) {
    throw new Error(`Docs API responded ${res.status} for ${url}`);
  }
  return res.text();
}

export function registerDocsTools(mcpServer: McpServer): void {
  mcpServer.tool(
    'orchestkit_docs_search',
    'Search the OrchestKit documentation; returns ranked pages with titles and URLs. Read-only.',
    {
      query: z.string().min(1).describe("Search term, e.g. 'install' or 'memory'"),
      tag: z
        .enum(['docs', 'skill', 'agent', 'hook', 'composition'])
        .optional()
        .describe('Restrict results to one content type. Omit to search everything.'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results to return'),
    },
    async ({ query, tag, limit }) => {
      const params = new URLSearchParams({ query });
      if (tag) params.set('tag', tag);
      if (limit) params.set('limit', String(limit));
      try {
        return text(await fetchText(`${DOCS_ORIGIN}/api/search?${params}`, 'application/json'));
      } catch (error) {
        return text(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  mcpServer.tool(
    'orchestkit_docs_get',
    'Fetch one OrchestKit documentation page as Markdown by its path (e.g. /docs/getting-started/installation). Read-only.',
    {
      path: z
        .string()
        .min(1)
        .regex(/^[\w\-./]+$/, 'Doc paths contain only word characters, dots, dashes, and slashes')
        .describe("Doc URL path, e.g. '/docs/getting-started/installation'"),
    },
    async ({ path }) => {
      const clean = `/${path.replace(/^\/+/, '').replace(/\.md$/, '')}`;
      try {
        return text(await fetchText(`${DOCS_ORIGIN}${clean}.md`, 'text/markdown'));
      } catch (error) {
        return text(
          `Could not fetch '${clean}': ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
