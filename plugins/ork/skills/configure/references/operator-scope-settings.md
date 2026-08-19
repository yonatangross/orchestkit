# Operator-Scope Settings

Paste-ready JSON for controls a plugin bundle **cannot** carry. Everything here goes
into the operator's own `~/.claude/settings.json`. Nothing in this file is applied by
`ork:configure`, by `ork:doctor`, or by any hook. Reading it changes nothing; pasting
it is a deliberate operator decision with a one-key rollback.

This is the section `ork:doctor` Check 16 points at when it reports a missing
`sandbox` block or missing credential-read denies.

## Why operator scope, and only operator scope

A plugin's bundled `settings.json` is not one of the scopes Claude Code merges.
`plugins-reference.md:858` supports only `agent` and `subagentStatusLine` there;
every other key is silently stripped. ork used to declare a full `sandbox` block in
`src/settings/ork.settings.json`. It was inert for its whole life and was deleted in
a93ccb735 (#3357). The deletion was right. The opinion it carried is what this file
re-homes.

Scope matters a second time inside the sandbox schema itself. Read from the installed
binary (2.1.234), several keys carry the note:

> Only honored from user, managed/policy, or CLI settings. Project settings
> (`.claude/settings.json` and `.claude/settings.local.json`) are ignored.

`strictAllowlist` is one of them. So a repo-local settings file cannot arm the strict
stage even if you put it there. `deniedDomains` is the opposite case, documented as
"merged from all settings sources", which is part of why stage 1 leans on it.

## Start with stage 1

Two stages, per the rollout recorded in #3424. **Start with stage 1.** It is designed
to be adoptable on a working machine: no network allowlist, so nothing is denied for
being unlisted, and the three workflows this machine's history shows as fragile
(`op`, `docker`, `ssh`) run outside the sandbox entirely on an unforced machine. That
last clause is load-bearing; see *When the carve-out does nothing* below.

Stage 2 is the ratchet, and it is the one that breaks things. Do not paste it until
stage 1 has run through real work for several days.

| | Stage 1 LOOSE | Stage 2 STRICT |
|---|---|---|
| Exfil denylist | yes | yes |
| Credential file denies | yes | yes |
| Credential env denies | yes | yes |
| Network allowlist | **no** | yes |
| Unlisted host | prompts | denied outright |
| Carve-outs | `op`, `docker`, `ssh` | shrink on evidence |
| Expected breakage | none intended | first run will hit it |

## Stage 1 LOOSE

Merge this into `~/.claude/settings.json` at the top level.

```json
{
  "permissions": {
    "deny": [
      "Read(~/.aws/credentials)",
      "Read(~/.ssh/**)",
      "Read(~/.gnupg/**)",
      "Read(~/.netrc)",
      "Read(~/.npmrc)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "autoAllowBashIfSandboxed": true,
    "excludedCommands": ["op", "docker", "ssh"],
    "network": {
      "strictAllowlist": false,
      "deniedDomains": [
        "pastebin.com",
        "paste.ee",
        "hastebin.com",
        "ix.io",
        "transfer.sh",
        "0x0.st",
        "anonfile.com",
        "bashupload.com",
        "termbin.com",
        "dpaste.com",
        "sprunge.us",
        "webhook.site",
        "*.ngrok.io",
        "*.ngrok-free.app",
        "*.ngrok.app",
        "*.trycloudflare.com",
        "*.serveo.net",
        "requestbin.com",
        "*.requestbin.com"
      ]
    },
    "filesystem": {
      "denyRead": ["~/.aws/credentials", "~/.ssh", "~/.gnupg", "~/.netrc", "~/.npmrc"]
    },
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" },
        { "path": "~/.gnupg", "mode": "deny" },
        { "path": "~/.netrc", "mode": "deny" },
        { "path": "~/.npmrc", "mode": "deny" }
      ],
      "envVars": [
        { "name": "ANTHROPIC_API_KEY", "mode": "deny" },
        { "name": "GH_TOKEN", "mode": "deny" },
        { "name": "GITHUB_TOKEN", "mode": "deny" },
        { "name": "GITHUB_PERSONAL_ACCESS_TOKEN", "mode": "deny" },
        { "name": "NPM_TOKEN", "mode": "deny" }
      ]
    }
  }
}
```

### The two layers are not redundant

`permissions.deny` stops the `Read` **tool**. It does nothing about a Bash subprocess
reading the same file. `sandbox.filesystem.denyRead` and `sandbox.credentials.files`
are what stop `cat ~/.ssh/id_rsa`. Doctor reports them as two separate findings for
exactly this reason.

### If something in stage 1 does break

Each of these is a single-line deletion, and each one is a known, named risk rather
than a surprise:

| Symptom | Line to drop | Why |
|---|---|---|
| `gh` fails to authenticate inside Bash | the `GH_TOKEN` / `GITHUB_TOKEN` envVars entries | `mode: "deny"` **unsets** the variable for sandboxed commands. `gh` falls back to its stored host credentials, which usually works, but not if your setup is env-var only |
| `npm publish` fails with 401 | the `NPM_TOKEN` entry | same mechanism |
| A tool that reads `~/.npmrc` for a registry URL breaks | the `~/.npmrc` entries | the deny is whole-file, not per-key |
| Anything else broke | delete the whole `sandbox` key | rollback is one key, effective next session |

**Not measured here.** These rows are read off the key semantics in the 2.1.234
schema, not off a live sandboxed session on this machine. Nobody has run stage 1 for a
day yet. That is what stage 1 is for.

### How to tell it is working

1. `ork:doctor` Check 16 should flip from the failing shape to `sandbox enabled,
   deniedDomains: 19, credentials.files: 5`.
2. Check 15 reads `settings.local.json` only, so it may still say "off" while Check 16
   says "on". That disagreement is expected and is a scope difference, not a bug.
3. The direct test: in a normal session, ask for `curl -s https://webhook.site/test`.
   Before, this ABSTAINS through the hook layer and the request goes out. Under
   stage 1 the sandbox should stop it, because `deniedDomains` is an always-block list
   independent of `strictAllowlist`.
4. `op`, `docker` and `ssh` should behave exactly as they did before. If they do not,
   the carve-out is not taking effect and that is worth reporting before going further.

## When the carve-out does nothing

`excludedCommands` is not an unconditional escape hatch, and the condition is invisible
from the settings file. Read from the sandbox decision function in the 2.1.235 binary:

```js
function N7(e){
  if (dL() && $dt()) return true;                                  // forced sandbox
  if (!ti.isSandboxingEnabled()) return false;
  if (e.dangerouslyDisableSandbox && areUnsandboxedCommandsAllowed()) return false;
  if (!JYe().unsandboxedCommandsDisabled && rsT(e.command)) return false;  // excludedCommands
  return true;
}
```

`rsT` is the `excludedCommands` matcher. `N7` returning true means the command gets
sandboxed; the two branches above the matcher (sandboxing off, and an explicit
disable) fix that polarity beyond doubt. So on a normal machine a match returns false
and the command really does run unsandboxed, which is what stage 1 relies on.

Two guards defeat it:

- **A forced sandbox short-circuits first.** `dL() && $dt()` returns true *before*
  `excludedCommands` is ever consulted. In that environment every command is wrapped
  and the carve-out is dead config.
- **`unsandboxedCommandsDisabled` skips the branch**, with the same result.

This is not theoretical. Measured 2026-08-19 from inside Claude Code's own sandboxed
Bash: `ssh` TCP connect returned EPERM, raw DNS was dead, and the docker daemon socket
was denied, all while `excludedCommands` named those commands. The session running
those probes was itself in a forced sandbox, so the carve-out could not apply.

Two consequences worth holding at once:

1. **The carve-out opens no exfil surface in a forced or managed environment.** If you
   were worried that naming `op`, `docker` and `ssh` punches a hole in an enterprise
   policy sandbox, it does not: that sandbox wins before the list is read.
2. **Do not rely on it as an escape hatch in those environments either.** A tool that
   needs real host access will still fail, and the settings file will look like it
   should work. Debug that as a forced-sandbox condition, not as a typo in the list.

## Stage 2 STRICT

Only after stage 1 has held. Replace the `network` object from stage 1 with this, and
leave everything else as it is.

```json
{
  "sandbox": {
    "network": {
      "strictAllowlist": true,
      "allowedDomains": [
        "github.com",
        "*.npmjs.org",
        "*.pypi.org",
        "registry.terraform.io",
        "api.anthropic.com"
      ],
      "deniedDomains": [
        "pastebin.com",
        "paste.ee",
        "hastebin.com",
        "ix.io",
        "transfer.sh",
        "0x0.st",
        "anonfile.com",
        "bashupload.com",
        "termbin.com",
        "dpaste.com",
        "sprunge.us",
        "webhook.site",
        "*.ngrok.io",
        "*.ngrok-free.app",
        "*.ngrok.app",
        "*.trycloudflare.com",
        "*.serveo.net",
        "requestbin.com",
        "*.requestbin.com"
      ]
    }
  }
}
```

### What stage 2 breaks first, plainly

That five-entry allowlist is ork's old aspiration, not a survey of what this machine
actually talks to. With `strictAllowlist: true` every host outside it is denied with
no prompt. Expect the first failures in roughly this order:

1. **`api.github.com`.** `github.com` does not cover it, and `gh` lives on the API
   host. Every `gh` call fails.
2. **`registry.npmjs.org`.** `*.npmjs.org` covers it, but a lockfile pointing at
   `registry.yarnpkg.com` or a private registry does not.
3. **`localhost` and `*.localhost`.** portless dev URLs and agent-browser flows.
4. **Telemetry and error ingest.** Sentry, PostHog, Vercel.
5. **Anything a `curl` in a script reaches**, which is the long tail you cannot
   enumerate in advance.

This is why #3424 puts the observation window between the stages: the allowlist you
ship should come from what stage 1 saw, not from a list written before the sandbox ran.
Treat the five entries above as a seed, not an answer.

## Keys, verified against the installed binary

Probed against `~/.local/share/claude/versions/2.1.234` with **bare** matches. A
quoted pattern returns zero hits here because the minified bundle accesses properties
unquoted, which is a real way to conclude a live key does not exist.

| Key | `grep -c` lines | Used above |
|---|---|---|
| `sandbox.enabled` | schema-confirmed | stage 1 |
| `sandbox.failIfUnavailable` | 12 | no, see below |
| `sandbox.autoAllowBashIfSandboxed` | 8 | stage 1 |
| `sandbox.excludedCommands` | 6 | stage 1 |
| `sandbox.network.deniedDomains` | 8 | both |
| `sandbox.network.allowedDomains` | 16 | stage 2 |
| `sandbox.network.strictAllowlist` | 5 | both |
| `sandbox.network.allowUnixSockets` | 7 | no, available |
| `sandbox.filesystem.denyRead` | 16 | stage 1 |
| `sandbox.filesystem.allowWrite` | 15 | no, see below |
| `sandbox.credentials.files[].path` / `.mode` | schema-confirmed | stage 1 |
| `sandbox.credentials.envVars[].name` / `.mode` | schema-confirmed | stage 1 |

The credential entry shapes are read from the zod schema in the binary, not inferred
from ork's old block: `files[]` is `{path, mode}` and `envVars[]` is `{name, mode}`,
with `mode` constrained to `"deny"` or `"mask"`. On macOS and Windows `mask` degrades
to `deny`.

**Deliberately not published:**

- `failIfUnavailable: true`. Real key, and it is what ork's old block set. It exits
  with an error at startup when the sandbox cannot start. That is a hard gate meant
  for managed deployments, and it is a bad first move on a personal machine. The
  default is `false`: warn, then run unsandboxed. Consider flipping it after stage 2
  holds, when a silent fallback to unsandboxed is the thing you want to hear about.
- `filesystem.allowWrite`. Real key. ork's old value was
  `["${projectDir}", "/tmp", "~/.claude"]` and that interpolation is not something
  this file verified against user-scope settings. The schema documents path resolution
  as absolute, `~` expanded, or relative to the settings file root, which for user
  settings is `~/.claude`. Omitting the key keeps the default rather than shipping an
  unverified token.
- `allowUnixSockets` and `allowAllUnixSockets`. Real keys, macOS only, ignored on
  Linux. Available if a socket-based tool needs a carve-out. No value invented here.
- `credentials` masking (`extract`, `decode`, `awsPairs`). Requires
  `network.tlsTerminate` and a TLS-termination trust decision. #3424 puts it out of
  scope until after the strict stage.

## Related, and the retirement this feeds

`src/hooks/src/pretool/bash/network-egress-guard.ts` is the regex-shaped predecessor
of `deniedDomains`. It is still live and must stay live: its ASK tier is skipped under
`bypassPermissions`, which is how sessions on this machine actually run, so it is
weaker than it looks, but weaker is not nothing. #3322 retires it **after** the
sandbox is observed firing, not before.

Doctor's own account of the gap, including the measured hook-coverage probes, is in
`${CLAUDE_PLUGIN_ROOT}/skills/doctor/references/settings-posture.md`.
