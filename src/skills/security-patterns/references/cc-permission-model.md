# Claude Code Permission-Rule Semantics (security-relevant)

How Claude Code's `allow` / `ask` / `deny` permission rules actually behave as of
the supported floor (≥ 2.1.166 for every behavior below; current floor 2.1.168).
These are the facts OrchestKit security guidance depends on — get them wrong and a
"locked down" config has holes. Each behavior shipped in a specific release; all
are guaranteed present at the floor.

## 1. Read deny rules hide files from Glob/Grep (2.1.162)

A `Read` deny rule is now a real **secrecy** boundary, not just a read block:

```jsonc
// .claude/settings.json
{ "permissions": { "deny": ["Read(./.env*)", "Read(./secrets/**)"] } }
```

Matching files no longer appear in `Glob` or `Grep` results either — before 2.1.162
the agent could still *discover* (and infer from) denied paths via search even though
it couldn't read them. Treat `Read(deny)` as "this path does not exist for the agent."

- **Use it for:** secrets, key material, customer data dumps, `.env` families.
- **Pitfall:** a deny rule with a typo silently protects nothing — there is no
  "unknown path" warning (unlike deny *tool names*, see §2). Verify with a probe
  `Glob` after deploying.

## 2. Glob support in deny-rule tool-name position (2.1.166)

The tool-name slot of a deny rule accepts globs, enabling a **default-deny baseline**:

```jsonc
{ "permissions": {
    "deny":  ["*"],                       // deny ALL tools…
    "allow": ["Read(./src/**)", "Grep", "Glob"]   // …then re-allow the minimum
} }
```

- `"*"` in a deny rule denies every tool.
- **Allow** rules *reject* non-MCP globs (you cannot `allow: ["*"]`) — allow stays explicit by design.
- Unknown tool names in **deny** rules emit a startup **warning** (catches typos — the
  safety net §1 lacks). Watch the startup log when authoring deny lists.

## 3. Explicit WebFetch rules override the preapproved-host auto-allow (2.1.162)

CC auto-allows a built-in set of preapproved WebFetch domains. Before 2.1.162 your
explicit rules were ignored for those hosts; now **explicit `WebFetch(domain:…)`
deny/ask/allow takes precedence**:

```jsonc
{ "permissions": { "deny": ["WebFetch(domain:raw.githubusercontent.com)"] } }
// now actually blocks it, even though it's normally preapproved
```

- **Use it for:** blocking exfiltration sinks / paste hosts even when they're on the
  default allow-list; forcing `ask` on a sensitive internal domain.

## 4. Cross-session `SendMessage` relays carry no user authority (2.1.166)

Multi-agent hardening: a message relayed via `SendMessage` from **another** Claude
session no longer inherits the originating user's authority.

- Receivers **refuse** relayed permission requests.
- **auto mode blocks** them outright.

Implication for OrchestKit's multi-agent flows (agent-orchestration, mcp-patterns):
a peer or compromised session **cannot escalate** by asking your session to approve a
tool call on its behalf. Design fan-out so privileged actions run in the session that
legitimately holds the authority — do not route approvals through relays.

## 5. Org-managed permission rules apply for the whole session (2.1.163)

Enterprise lockdown reliability fix: org-managed permission rules now apply for the
**entire session** even when the managed-settings fetch completes during startup on a
fresh config directory (previously a first-run race left the session unmanaged). Also
in 2.1.163: a `Read(~/Desktop/**)`-style home-dir deny now also blocks `Bash` commands
that reach the path via `$HOME`.

- **Require 2.1.163+** when relying on org-managed profiles for a security boundary.
- Pairs with the 2.1.166 managed-settings enforcement fix (see SKILL.md "Managed Hook
  Hierarchy") — one invalid entry no longer voids the rest of the policy.

## 6. Permission rules can match tool input parameters (2.1.178)

Rules now match against a tool's **input parameters**, not just its name, with `*`
wildcard support. Syntax: `Tool(param:value)`. The headline use is gating subagent
spawns by model — `Agent(model:opus)` in a deny rule blocks any subagent attempted
with Opus; `Agent(model:*)` denies all model-pinned subagent spawns.

```jsonc
{ "permissions": { "deny": ["Agent(model:opus)", "Bash(rm:*)"] } }
```

- **Use it for:** a *hard* block on expensive or capability-risky subagent models, or
  parameter-level gates (e.g. specific `Bash` subcommands) that tool-name rules can't
  express. Combine with tool-name + file-path rules for defense-in-depth.
- **It is static** — a permission rule cannot run logic, read state, output advisory
  context, or prompt the user. For *advisory* model control (warn-don't-block, cost
  estimates, consent prompts) ork keeps its `model-cost-advisor` and
  `fable-spend-consent` hooks; the two are orthogonal (see `shared/rules/cc-native-first.md`).

## Recommended baseline posture

```jsonc
// .claude/settings.json — default-deny, explicit re-allow, secrecy on secrets
{ "permissions": {
    "deny":  ["*", "Read(./.env*)", "Read(./secrets/**)",
              "WebFetch(domain:pastebin.com)"],
    "allow": ["Read(./src/**)", "Read(./docs/**)", "Grep", "Glob",
              "Bash(npm run test:*)"],
    "ask":   ["Bash(git push:*)"]
} }
```

Verify after deploy: a `Grep` for a denied secret returns nothing (§1), the startup log
shows no "unknown tool" warnings (§2), and a denied preapproved WebFetch domain is
actually refused (§3).
