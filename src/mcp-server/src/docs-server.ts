#!/usr/bin/env node
/**
 * OrchestKit Docs MCP Server — stdio transport
 *
 * Standalone stdio variant of the remote Docs MCP server hosted at
 * https://orchestkit.yonyon.ai/api/mcp. Exposes the same two read-only tools
 * (documentation search + Markdown page fetch) by proxying the public docs
 * API, so it can run anywhere a Node process can — including registry checks
 * (Glama) and local MCP clients that prefer stdio over Streamable HTTP.
 *
 * Tool listing/introspection works offline; tool *calls* require network
 * access to the docs site.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerDocsTools } from './tools/docs.js';

const server = new McpServer({
  name: 'orchestkit-docs',
  version: '1.0.0',
});

registerDocsTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
