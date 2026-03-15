#!/usr/bin/env node
/**
 * OrchestKit MCP Server — ork-elicit
 *
 * Provides structured form elicitation via MCP for the setup wizard.
 * Registered in .mcp.json as a stdio transport.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerElicitTool } from './tools/ork-elicit.js';

const server = new McpServer({
  name: 'ork-elicit',
  version: '1.0.0',
});

registerElicitTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
