# /ork:dev boot sequence — annotated walkthrough

Each step below has a precondition and a post-condition. If a precondition fails, the skill exits 0 with a hint and does NOT proceed to the next step.

## Step 0 — detect package manager

| Signal | Manager |
|---|---|
| `packageManager` field in `package.json` | use that |
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` | bun |
| `package-lock.json` (or none of the above) | npm |

## Step 1 — resolve subdomain

```
git rev-parse --abbrev-ref HEAD                     # feat/m125-lane-b
| sed 's|/|-|g'                                      # feat-m125-lane-b
| tr '[:upper:]' '[:lower:]'
| sed 's/[^a-z0-9-]//g'                              # strip anything not URL-safe
+ ".localhost"                                       # feat-m125-lane-b.localhost
```

Cap at 63 chars (DNS label limit). Falsy result (detached HEAD, no git) → fall back to `dev.localhost`.

## Step 2 — portless

```bash
portless start --domain "$SUBDOMAIN" --tls --lan --background
```

Flags rationale:
- `--tls` (default since 0.10) — agent-browser sessions trust portless CA via auto-injected `NODE_EXTRA_CA_CERTS`.
- `--lan` — phone/tablet on same wifi can hit the same URL via mDNS, useful for responsive testing.
- `--background` — daemonize; we track the PID via `portless ls --json`.

Wait condition: `portless ls --json | jq ".[] | select(.domain==\"$SUBDOMAIN\")"` returns a row.

## Step 3 — emulate-seed (if needed)

```bash
test -f emulate.config.yaml || /ork:emulate-seed --auto
```

Reuses M125 #4. Skipped silently if `emulate.config.yaml` already exists.

## Step 4 — emulate up

```bash
emulate up --config emulate.config.yaml --port-base 4000 &
```

Wait condition: each declared service responds to `GET /healthz` on its assigned port (matrix in emulate-seed/SKILL.md).

## Step 5 — dev server

```bash
$PKG_MGR dev > .claude/state/dev.log 2>&1 &
```

`@emulators/adapter-next` (Next.js projects) routes `/api/_emulators/*` to the emulators on the same origin so OAuth callback URLs match production.

## Step 6 — wait-on

```bash
npx wait-on --httpTimeout 30000 --tlsCheck false "https://$SUBDOMAIN/healthz" || \
npx wait-on --httpTimeout 30000 --tlsCheck false "https://$SUBDOMAIN/"
```

`/healthz` first (most apps that have it return 200 fast); fall back to root.

## Step 7 — agent-browser session

```bash
agent-browser session start --name "$SUBDOMAIN" --keep-alive
agent-browser open "https://$SUBDOMAIN/"     # warm the connection
```

`--keep-alive` — session survives the parent shell exiting; `/ork:expect` reattaches by name.

## Step 8 — write state

JSON shape: see `references/state-schema.md`. Atomic: write `.claude/state/dev-stack.json.tmp` then rename — no half-written state if the skill is killed mid-write.

## Step 9 — print summary

```
ork:dev — feat/m125-lane-b
  ✓ portless     https://feat-m125-lane-b.localhost
  ✓ emulate      3 services (github, stripe, google-oauth)
  ✓ pnpm dev     port 3000
  ✓ agent-browser  session "feat-m125-lane-b"
Booted in 4.2s. Open https://feat-m125-lane-b.localhost or run /ork:expect.
```

## Teardown order (reverse of boot)

1. agent-browser session stop
2. dev server (SIGTERM, fall back to SIGKILL after 5s)
3. emulate (SIGTERM)
4. portless stop --domain $SUBDOMAIN
5. clear `.claude/state/dev-stack.json`

The reverse order matters: killing portless before agent-browser leaves agent-browser holding a TLS connection to nothing, which logs noise but isn't fatal.
