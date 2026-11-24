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
import { type HostEnv, HOST_IDS, detectHosts, installText, isHostId } from "./hosts.js";
import { type McpTransport, mcpConfig } from "./mcp-config.js";

/** Detection that finds nothing: the default when the caller injects no HostEnv. */
const NO_HOSTS: HostEnv = { env: {}, hasBin: () => false };

/** Claude Code's one-line install. Mirrors SITE.installCommand; defined in hosts.ts. */
export { PLUGIN_INSTALL_COMMAND } from "./hosts.js";

export const HELP = `orchestkit, CLI for OrchestKit by Yonyon: free, MIT skills and agents for
Claude Code, Cursor, Codex and five more coding agents

USAGE
  orchestkit <command> [options]

COMMANDS
  install [host]     Print the install command for the coding agents found here
                     (or for one host: claude, cursor, codex, devin, opencode,
                     muse, pi, agy; --all for every host)
  search <query>     Search the documentation
  ask <question>     Ask a natural-language question (NLWeb /ask)
  read <page>        Print a documentation page as Markdown
  mcp [http|stdio]   Print an MCP client config for the docs MCP server
  doctor             Check the local environment and API reachability
  help               Show this message

OPTIONS
  --limit <n>        Max results (1 to 100) for search (default 5) or ask (default 10)
  --json             Emit raw JSON instead of formatted text
  --base-url <url>   Override the API origin (env: ORCHESTKIT_BASE_URL)
  --version          Print the CLI version

EXAMPLES
  orchestkit search "parallel agents" --limit 3
  orchestkit read foundations/overview
  orchestkit mcp stdio > mcp.json

The docs API is public, read-only and unauthenticated. Rate limit: 120 requests
per minute per IP per endpoint. Policy: https://orchestkit.dev/api-policy
`;

export type ParsedArgs = {
	command: string;
	positional: string[];
	limit?: number;
	json: boolean;
	all: boolean;
	baseUrl?: string;
	help: boolean;
	version: boolean;
};

class UsageError extends Error {}

function isOptionToken(value: string): boolean {
	return value.startsWith("--") || value === "-h" || value === "-v";
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
	const positional: string[] = [];
	let limit: number | undefined;
	let json = false;
	let all = false;
	let help = false;
	let version = false;
	let baseUrl: string | undefined;
	let unknownOption: string | undefined;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (arg === "--") {
			positional.push(...argv.slice(i + 1));
			break;
		}
		if (arg === "--all") all = true;
		else if (arg === "--json") json = true;
		else if (arg === "--help" || arg === "-h") help = true;
		else if (arg === "--version" || arg === "-v") version = true;
		else if (arg === "--limit" || arg === "--base-url") {
			const value = argv[i + 1];
			if (value === undefined || isOptionToken(value)) {
				throw new UsageError(`${arg} requires a value.`);
			}
			i++;
			if (arg === "--limit") {
				if (!/^[+-]?\d+$/.test(value)) {
					throw new UsageError("--limit requires an integer.");
				}
				const requestedLimit = Number(value);
				if (requestedLimit < 1 || requestedLimit > 100) {
					throw new UsageError("--limit must be between 1 and 100.");
				}
				limit = requestedLimit;
			} else {
				baseUrl = value;
			}
		} else if (arg.startsWith("-")) unknownOption ??= arg;
		else positional.push(arg);
	}

	// Help and version answer before any command, wherever they appear, and help
	// wins when both are given.
	let command: string;
	if (help) command = "help";
	else if (version) command = "version";
	else command = positional.shift() ?? "help";
	if (unknownOption && !help && !version) throw new UsageError(`Unknown option "${unknownOption}".`);
	if (all && !help && !version && command !== "install") throw new UsageError('Unknown option "--all".');
	return { command, positional, limit, json, all, baseUrl, help, version };
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
	results: { url: string; title?: string; description?: string; content?: string }[],
	rl: RateLimit,
	baseUrl: string,
): string {
	if (results.length === 0) {
		return "No matches. Try a broader query, or browse https://orchestkit.dev/llms.txt\n";
	}
	const lines = results.map((r, i) => {
		const title = r.title ?? r.content ?? r.url;
		const desc = r.description ? `\n     ${r.description}` : "";
		return `  ${i + 1}. ${title}\n     ${baseUrl}${r.url}${desc}`;
	});
	return `${lines.join("\n")}\n${rateLimitNote(rl)}`;
}

export async function run(
	argv: readonly string[],
	deps: {
		version: string;
		clientFactory?: (o: Partial<Client>) => Client;
		hostEnv?: HostEnv;
	} = {
		version: "0.0.0",
	},
): Promise<RunResult> {
	try {
		const args = parseArgs(argv);
		if (["install", "mcp", "read"].includes(args.command) && args.positional.length > 1) {
			throw new UsageError(`${args.command} accepts at most one positional argument.`);
		}
		const makeClient = deps.clientFactory ?? createClient;
		const client = makeClient({ baseUrl: args.baseUrl });

		switch (args.command) {
			case "help":
				return ok(HELP);

			case "version":
				return ok(`${deps.version}\n`);

			case "install": {
				const target = args.positional[0];
				if (args.all) {
					if (target !== undefined) throw new UsageError("install cannot combine --all with a host.");
					return ok(installText(HOST_IDS));
				}
				if (target !== undefined) {
					if (!isHostId(target)) {
						return fail(`Unknown host "${target}". Use one of: ${HOST_IDS.join(", ")}.\n`, 2);
					}
					return ok(installText([target]));
				}
				return ok(installText(detectHosts(deps.hostEnv ?? NO_HOSTS)));
			}

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
				const { results, rateLimit } = await search(client, query, args.limit ?? 5);
				return ok(
					args.json
						? `${JSON.stringify(results, null, 2)}\n`
						: formatSearch(results, rateLimit, client.baseUrl),
				);
			}

			case "ask": {
				const query = args.positional.join(" ").trim();
				if (!query) return fail("Usage: orchestkit ask <question>\n", 2);
				const { data } = await ask(client, query, args.limit);
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
				const nodeSupported = major >= 20;
				let failed = !nodeSupported;
				checks.push(
					nodeSupported
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
					failed = true;
					checks.push(
						`  FAIL  API unreachable at ${client.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
				const body = `orchestkit doctor\n\n${checks.join("\n")}\n`;
				return failed ? { stdout: body, stderr: "", exitCode: 1 } : ok(body);
			}

			default:
				return fail(`Unknown command "${args.command}".\n\n${HELP}`, 2);
		}
	} catch (err) {
		if (err instanceof UsageError) return fail(`${err.message}\n`, 2);
		if (err instanceof ApiError) {
			const retry =
				err.retryAfter !== null ? ` Retry after ${err.retryAfter}s.` : "";
			return fail(`Error ${err.status}: ${err.message}${retry}\n`, 1);
		}
		return fail(`Error: ${err instanceof Error ? err.message : String(err)}\n`, 1);
	}
}
