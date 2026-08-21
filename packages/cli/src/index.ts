// Public module surface, so the CLI is also usable as a library:
//   import { createClient, search } from "orchestkit";
export {
	ApiError,
	DEFAULT_BASE_URL,
	createClient,
	getJson,
	getMarkdown,
	readDoc,
	readRateLimit,
	ask,
	search,
} from "./api.js";
export type {
	Client,
	Problem,
	RateLimit,
	SearchHit,
} from "./api.js";
export { HOSTED_MCP_URL, STDIO_MCP_IMAGE, mcpConfig } from "./mcp-config.js";
export type { McpTransport } from "./mcp-config.js";
export { PLUGIN_INSTALL_COMMAND, run, parseArgs, HELP } from "./cli-core.js";
