// Command dispatch, kept free of process.exit() and top-level side effects so
// every command is directly unit-testable. src/cli.ts is the thin bin wrapper
// that owns argv, stdout and the exit code.

import {
	ApiError,
	type Client,
	type RateLimit,
	ask,
	createClient,
	readDoc,
	search,
} from "./api.js";
import { type McpTransport, mcpConfig } from "./mcp-config.js";

/** The one supported way to install the plugin. Mirrors SITE.installCommand. */
export const PLUGIN_INSTALL_COMMAND = "claude install orchestkit/ork";

export const HELP = `orchestkit, CLI for OrchestKit, the Claude Code plugin by Yonyon

USAGE
  orchestkit <command> [options]

COMMANDS
  install            Print the Claude Code command that installs the plugin
  search <query>     Search the documentation
  ask <question>     Ask a natural-language question (NLWeb /ask)
  read <page>        Print a documentation page as Markdown
  mcp [http|stdio]   Print an MCP client config for the docs MCP server
  doctor             Check the local environment and API reachability
  help               Show this message

OPTIONS
  --limit <n>        Max search results (default 5)
  --json             Emit raw JSON instead of formatted text
  --base-url <url>   Override the API origin (env: ORCHESTKIT_BASE_URL)
  --version          Print the CLI version

EXAMPLES
  orchestkit search "parallel agents" --limit 3
  orchestkit read foundations/overview
  orchestkit mcp stdio > mcp.json

The docs API is public, read-only and unauthenticated. Rate limit: 120 requests
per minute per IP per endpoint. Policy: https://orchestkit.yonyon.ai/api-policy
`;

export type ParsedArgs = {
	command: string;
	positional: string[];
	limit: number;
	json: boolean;
	baseUrl?: string;
	version: boolean;
};

export function parseArgs(argv: readonly string[]): ParsedArgs {
	const positional: string[] = [];
	let limit = 5;
	let json = false;
	let version = false;
	let baseUrl: string | undefined;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (arg === "--json") json = true;
		else if (arg === "--version" || arg === "-v") version = true;
		else if (arg === "--limit") {
			const next = Number.parseInt(argv[++i] ?? "", 10);
			// A bad --limit silently falling back to the default would hide the typo
			// in a script; clamping to a sane range is the honest middle ground.
			if (Number.isFinite(next)) limit = Math.min(Math.max(next, 1), 50);
		} else if (arg === "--base-url") baseUrl = argv[++i];
		else if (arg.startsWith("-")) positional.push(arg);
		else positional.push(arg);
	}

	const command = positional.shift() ?? (version ? "version" : "help");
	return { command, positional, limit, json, baseUrl, version };
}

export type RunResult = { stdout: string; stderr: string; exitCode: number };

function ok(stdout: string): RunResult {
	return { stdout, stderr: "", exitCode: 0 };
}

function fail(stderr: string, exitCode = 1): RunResult {
	return { stdout: "", stderr, exitCode };
}

function rateLimitNote(rl: RateLimit): string {
	if (rl.limit === null || rl.remaining === null) return "";
	return `\n${rl.remaining}/${rl.limit} requests left in this window (resets in ${rl.reset ?? "?"}s).\n`;
}

function formatSearch(
	results: { url: string; title?: string; description?: string }[],
	rl: RateLimit,
	baseUrl: string,
): string {
	if (results.length === 0) {
		return "No matches. Try a broader query, or browse https://orchestkit.yonyon.ai/llms.txt\n";
	}
	const lines = results.map((r, i) => {
		const title = r.title ?? r.url;
		const desc = r.description ? `\n     ${r.description}` : "";
		return `  ${i + 1}. ${title}\n     ${baseUrl}${r.url}${desc}`;
	});
	return `${lines.join("\n")}\n${rateLimitNote(rl)}`;
}

export async function run(
	argv: readonly string[],
	deps: { version: string; clientFactory?: (o: Partial<Client>) => Client } = {
		version: "0.0.0",
	},
): Promise<RunResult> {
	const args = parseArgs(argv);
	const makeClient = deps.clientFactory ?? createClient;
	const client = makeClient({ baseUrl: args.baseUrl });

	try {
		switch (args.command) {
			case "help":
			case "--help":
			case "-h":
				return ok(HELP);

			case "version":
			case "--version":
				return ok(`${deps.version}\n`);

			case "install":
				return ok(
					[
						"OrchestKit is a Claude Code plugin. Install it from inside Claude Code:",
						"",
						`  ${PLUGIN_INSTALL_COMMAND}`,
						"",
						"Requires Claude Code. Docs: https://orchestkit.yonyon.ai/docs/getting-started/installation",
						"",
					].join("\n"),
				);

			case "mcp": {
				const transport = (args.positional[0] ?? "http") as McpTransport;
				if (transport !== "http" && transport !== "stdio") {
					return fail(`Unknown transport "${transport}". Use "http" or "stdio".\n`, 2);
				}
				return ok(mcpConfig(transport));
			}

			case "search": {
				const query = args.positional.join(" ").trim();
				if (!query) return fail("Usage: orchestkit search <query>\n", 2);
				const { results, rateLimit } = await search(client, query, args.limit);
				return ok(
					args.json
						? `${JSON.stringify(results, null, 2)}\n`
						: formatSearch(results, rateLimit, client.baseUrl),
				);
			}

			case "ask": {
				const query = args.positional.join(" ").trim();
				if (!query) return fail("Usage: orchestkit ask <question>\n", 2);
				const { data } = await ask(client, query);
				return ok(`${JSON.stringify(data, null, 2)}\n`);
			}

			case "read": {
				const page = args.positional[0];
				if (!page) return fail("Usage: orchestkit read <page>\n", 2);
				const { text } = await readDoc(client, page);
				return ok(text.endsWith("\n") ? text : `${text}\n`);
			}

			case "doctor": {
				const checks: string[] = [];
				const major = Number.parseInt(
					process.versions.node.split(".")[0] ?? "0",
					10,
				);
				checks.push(
					major >= 20
						? `  ok    node ${process.versions.node} (>= 20 required)`
						: `  FAIL  node ${process.versions.node}, OrchestKit CLI needs Node >= 20`,
				);
				try {
					const { data, rateLimit } = await import("./api.js").then((m) =>
						m.getJson<{ status?: string }>(client, "/api/health"),
					);
					checks.push(`  ok    API reachable at ${client.baseUrl} (${data.status ?? "ok"})`);
					checks.push(
						rateLimit.limit === null
							? "  warn  no RateLimit-* headers on the response"
							: `  ok    rate limit ${rateLimit.remaining}/${rateLimit.limit}, resets in ${rateLimit.reset}s`,
					);
				} catch (err) {
					checks.push(
						`  FAIL  API unreachable at ${client.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
				const failed = checks.some((c) => c.includes("FAIL"));
				const body = `orchestkit doctor\n\n${checks.join("\n")}\n`;
				return failed ? { stdout: body, stderr: "", exitCode: 1 } : ok(body);
			}

			default:
				return fail(`Unknown command "${args.command}".\n\n${HELP}`, 2);
		}
	} catch (err) {
		if (err instanceof ApiError) {
			const retry =
				err.retryAfter !== null ? ` Retry after ${err.retryAfter}s.` : "";
			return fail(`Error ${err.status}: ${err.message}${retry}\n`, 1);
		}
		return fail(`Error: ${err instanceof Error ? err.message : String(err)}\n`, 1);
	}
}
