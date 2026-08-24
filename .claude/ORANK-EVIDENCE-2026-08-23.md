# orank report refutations, measured 2026-08-23

All of this was probed against **live prod**, not inferred from the report and not
re-read from memory. Score at time of probe: 86/A, `scannedAt 2026-08-23T07:08:35Z`.

Standing rule this reinforces: an orank gap is a *claim* until a live probe confirms it.

## 1. The "dead" npm links are a Cloudflare bot challenge, not dead links

Report: *"2 of 5 probed llms.txt links do not resolve: npmjs.com/package/orchestkit and
npmjs.com/package/@orchestkit/hook-contract."*

Measured response headers from `www.npmjs.com`:

```
HTTP/2 403
cf-mitigated: challenge
server: cloudflare
body: <!DOCTYPE html>...<title>Just a moment...</title>
```

The CONNECT succeeded (`HTTP/1.1 200 Connection Established`); npm's edge returned the
challenge. Both packages genuinely exist, confirmed against the registry, which is not
challenged:

- `registry.npmjs.org/orchestkit` -> 200, `dist-tags.latest = 0.1.0`
- `registry.npmjs.org/@orchestkit/hook-contract` -> 200

**Consequence:** this is not a sandbox problem and no local allowlist entry can fix a
challenge served by the far side. The honest fix is to repoint llms.txt at
`registry.npmjs.org`, which resolves for agents and is the more appropriate surface for a
machine-readable index anyway. Removing the links would be wrong: they are not broken.

## 2. skills.sh returns 200 while two checks claim it does not exist

`https://www.skills.sh/yonatangross/orchestkit` -> **HTTP 200**.

Two checks disagree with that: `skills-sh-listed` (0/1, "No official skills self-published
on skills.sh") and `skills-sh-quality` (0/2, "No official skills on skills.sh to
evaluate"). 3 points total. The URL is also declared in `/llms.txt` and in `SAME_AS`.

**Consequence:** scanner-side discovery miss. Not fixable by editing our artifacts.
Worth reporting upstream rather than working around.

## 3. The five auth findings are deliberate, and already documented in prose

`/auth.md` (live, 200) states outright:

> `/.well-known/oauth-authorization-server` 404s intentionally, there is no authorization
> server, and publishing RFC 8414 metadata for one that does not exist would be misleading.

> This API does not support agentic registration; the registration walkthrough is N/A by
> design. There is no `register_uri`, `claim_uri`, or `revocation_uri`.

> No `WWW-Authenticate` challenge is returned by any endpoint, there is never a `401` to
> challenge.

PRM at `/.well-known/oauth-protected-resource` returns 200 with `authorization_servers: []`
and `bearer_methods_supported: []`. Those empty arrays are the honest encoding of
anonymous-only access; orank reads empty as absent.

Affected checks, 8 points: `auth-md-walkthrough-simulation` (0/2),
`agent-auth-discovery-metadata` (1/3), `agent-auth-endpoints-reachable` (0/2),
`agent-auth-www-authenticate` (0/1), `oauth-protected-resource` (1/2).

**Consequence:** satisfying these means publishing an OAuth authorization server,
registration endpoints and a 401 challenge for an API that is free, read-only and
unauthenticated. That is fabrication, and it would mislead the very agents orank exists to
serve. Refused, consistent with the 2026-07-21 triage.

## 4. MEMORY WAS WRONG: ard-trust-manifest is scoring again

`feedback_orank_trustmanifest_nonscoring_bonus` records this as a non-scoring bonus that
earned +0 in July, on the reasoning that the parent `ard-catalog` check was already
`pass 3/3`.

**That is no longer true.** The live API now reports a standalone check:

```
0/2 fail ard-trust-manifest
```

orank changed its scoring; it is a real 2 points again. Do not skip it on the strength of
the July note.

The July note's *other* claim still holds, and is exactly why that attempt scored zero:
the scanner reads `hasTrustManifest` off **entries**, not `host`. A host-level
trustManifest already exists in `/.well-known/ai-catalog.json` and is not credited. Put it
on the five entries.

## 5. Do not grep the working tree for what prod serves

An exploration pass reported npm absent from `llms.txt`, based on a repo grep. Live
`/llms.txt` carries both links (2 hits). The local checkout was 36 commits behind
origin/main, so the grep read stale source and would have removed a real finding from the
plan.

Grep `origin/main`, or probe prod. Not the working tree.

## Scoreboard as measured

| Bucket | Points | Disposition |
|---|---|---|
| Honest and code-addressable | ~7 | Doing: markdown alternate, frontmatter, bot-UA, trustManifest-on-entries, agent-plugins `$schema`, llms.txt link repoint |
| Fabrication if "fixed" | 12 | Refused: 5 auth checks, sandbox, product MCP |
| Already refuted by measurement | 2 | Multi-language SDK. PyPI was published in July and the check still says "found only in npm", so domain-matching was never the gate |
| Scanner-side miss | 3 | skills.sh, returns 200. Report upstream |
| Off-site / structural | 15 | Wikipedia/Wikidata, ChatGPT directory, brand and developer-resource discoverability. The brand collision is documented and caps Discovery |

Realistic ceiling from code alone is roughly 93, not a grade jump.

## Rescan discipline

A rescan before the deploy actually serves the change returns a cached number. Poll the
artifact until it is live, then `POST https://ora.ai/api/scan`, and do not quote a new
score until it visibly changes.
