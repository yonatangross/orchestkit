// MCP client configuration snippets. Both surfaces are real and documented at
// https://orchestkit.dev/developers, the hosted Streamable HTTP endpoint
// and the stdio Docker image. Emitted as JSON so it can be piped straight into
// a client config file rather than retyped.

export const HOSTED_MCP_URL = "https://orchestkit.dev/api/mcp";
export const STDIO_MCP_IMAGE = "ghcr.io/yonatangross/orchestkit-docs-mcp";

export type McpTransport = "http" | "stdio";

export function mcpConfig(transport: McpTransport): string {
	const server =
		transport === "http"
			? { type: "http", url: HOSTED_MCP_URL }
			: {
					command: "docker",
					args: ["run", "-i", "--rm", STDIO_MCP_IMAGE],
				};
	return `${JSON.stringify({ mcpServers: { orchestkit: server } }, null, 2)}\n`;
}
