# orchestkit

Official CLI for [OrchestKit](https://orchestkit.dev), free and MIT-licensed
skills and agents for Claude Code, Cursor, Codex and five more coding agents,
published by the Yonyon software studio.

```bash
npx orchestkit --help     # no install
npm i -g orchestkit       # or install it
```

Published on npm as [`orchestkit`](https://www.npmjs.com/package/orchestkit).
Also aliased as `ork`.

## What it does

OrchestKit itself installs into your coding agent, not into your shell. This
CLI is the *scripting* surface around it: it finds the coding agents on this
machine and prints the install command for each, emits MCP
client config, and queries the public read-only docs API from a terminal or a
CI job without writing a fetch wrapper first.

```
orchestkit install            # install commands for the coding agents found here
orchestkit install codex      # one host: claude, cursor, codex, devin, opencode, muse, pi, agy
orchestkit install --all      # every host
orchestkit search <query>     # search the documentation
orchestkit ask <question>     # natural-language query (NLWeb /ask)
orchestkit read <page>        # print a docs page as Markdown
orchestkit mcp [http|stdio]   # emit MCP client config
orchestkit doctor             # check Node, API reachability, rate-limit budget
```

Options: `--limit <n>`, `--json`, `--base-url <url>` (or `ORCHESTKIT_BASE_URL`).

## Examples

```bash
orchestkit search "parallel agents" --limit 3
orchestkit read foundations/overview > overview.md
orchestkit mcp stdio > mcp.json
orchestkit search "hooks" --json | jq -r '.[].url'
```

## Library use

The same surface is importable, so a script can skip the shell:

```ts
import { createClient, search } from "orchestkit";

const { results, rateLimit } = await search(createClient(), "memory", 5);
console.log(results[0]?.url, `${rateLimit.remaining}/${rateLimit.limit} left`);
```

## API contract

The docs API is public, read-only and unauthenticated.

- **Rate limits**, 120 requests per minute per IP per endpoint. Every response
  carries the IETF `RateLimit-*` headers. Formatted `search` shows the remaining
  budget when there are matches and the limit and remaining values are available.
  `search --json`, `ask`, and `read` keep stdout raw. Scripts that need quota
  information can use the library's `rateLimit` value on successful calls.
  On HTTP 429, the library throws an `ApiError`; use its `retryAfter` value
  when present to decide when to retry.
- **Errors**, RFC 9457 Problem Details. `ApiError.problem` exposes the parsed
  object, including the `links` recovery hops a 404 carries.
- **Versioning and deprecation**, <https://orchestkit.dev/api-policy>.

## Requirements

Node >= 20 (uses global `fetch`). Zero runtime dependencies.

## Development

```bash
npm run build        # tsc + shebang/exec-bit fixup
npm test             # unit suite + spawn tests against the built binary
npm run publish:dry-run
```

`npm test` spawns `dist/cli.js` for real, so run `npm run build` first or those
cases skip. Networked commands are spawned with a preloaded `fetch` stub
(`tests/fixtures/fetch-stub.mjs`), hermetic, no socket, no live site.

## Releasing

1. `npm run build && npm test && npm run publish:dry-run`
2. `npm publish --access public` (name `orchestkit` was unregistered as of
   2026-08-21; re-check before releasing)
3. The site claims this package in `docs/site/lib/developer-resources.ts` and
   `docs/site/app/llms.txt/route.ts`. Keep those true: a docs link to a version
   or a command that does not exist is worse than no link.

**Check `npm publish --dry-run` output, not just `npm pack`.** They normalize
differently. npm 11 deletes any `bin` value starting with `./`, and pack keeps
the field while publish strips it, so a pack-based check cannot see it. See
`tests/package-publish.test.ts`.

MIT © Yonatan Gross
