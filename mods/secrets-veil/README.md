# secrets-veil

A Claude Code mod that masks secret values in tool results before the model
reads them. It arms once per session and covers every tool result
afterwards. There is no reveal path: once a value is covered, it stays
covered for the session.

## How it works

Three layers, checked on every tool result:

1. **Named masking.** At `session.start` the mod reads 21 widely known
   vendor variable names with one literal `$.env.get` call site per name:

   `ANTHROPIC_API_KEY` `OPENAI_API_KEY` `GEMINI_API_KEY` `GOOGLE_API_KEY`
   `MISTRAL_API_KEY` `GROQ_API_KEY` `OPENROUTER_API_KEY` `HF_TOKEN`
   `GITHUB_TOKEN` `GH_TOKEN` `GITLAB_TOKEN` `NPM_TOKEN` `AWS_ACCESS_KEY_ID`
   `AWS_SECRET_ACCESS_KEY` `AWS_SESSION_TOKEN` `AZURE_OPENAI_API_KEY`
   `STRIPE_SECRET_KEY` `SLACK_BOT_TOKEN` `VERCEL_TOKEN`
   `CLOUDFLARE_API_TOKEN` `OP_SERVICE_ACCOUNT_TOKEN`

   A resolved value is kept only if it is at least 8 characters. Every
   occurrence of a kept value is masked in tool output.

2. **Value shapes.** Vendor prefixes and markers: `sk-ant-`, `ops_`, `ghp_`,
   `github_pat_`, `xoxb-`, `AKIA`, `Bearer ` (20 or more following
   characters), and PEM private key blocks.

3. **High entropy.** A token of 20 or more characters from
   `[A-Za-z0-9+/=_-]` whose Shannon entropy is at or above **4.3 bits per
   character** is masked. The threshold is chosen so that counting alone,
   not luck, protects git output: any hex string (a 40-char git sha, a
   64-char hash) has entropy at most 4.0, a UUID at most 4.09, both below
   the bar always. Uniform random tokens over the same alphabet measured a
   median of 4.60 bits/char (200k samples, 2026-09-16). Ordinary words,
   paths and identifiers measured 2.9 to 4.0. Masked output never reveals
   length beyond an 8-bullet floor.

If zero named values resolve at `session.start`, the mod emits one
`$.ui.notice` saying the veil is running on value patterns and entropy only.
Silence is not allowed: an operator must know the named layer is empty.

**It fails closed.** A tool result is never returned unmasked. If a
`tool.call` arrives before `session.start` has armed the veil (a mod enabled
or hot-reloaded mid-session; on CC 2.1.282 a reload re-dispatches
`session.start` about a second after "reloaded"), the mod arms itself on the
spot with the same named reads. If those reads fail it falls back to value
shapes and entropy alone, and if a result cannot be masked at all it is
withheld with `{ deny }` rather than shown. The same holds for a result, or a
single value in it, that is larger than a fixed size cap, a value the veil cannot
rebuild faithfully (a Buffer, a Map), and any failure the runtime sees in
the hook: each is withheld, none is passed through.

## Seeing it work

When a tool result had at least one value covered, the mod says so where
you can see it (Claude Code shows each line with the plugin name in front):

- a toast: `masked 1 value in Bash`;
- a status line under the prompt: `3 masked this session`;
- the byte counts in the debug log only, via `$.ui.log(text, { to: "debug" })`:
  `40 bytes in, 24 bytes out` (UTF-8 bytes of the covered values, then of the
  bullets that replaced them; a bullet is 3 bytes, at most 8 per value), plus
  the whole result's byte size before and after masking. Without `to: "debug"`
  a `$.ui.log` line lands in the transcript, and a per-secret byte length is a
  hint about the secret, so it stays out of anything a human or the
  transcript sees.

These lines carry counts only, never a value. Nothing is shown when nothing
was masked. A refused toast or status never unmasks a result. Every awaited UI
call has a deadline through `$.clock.after` (a mod has no ambient timers): 3 s
for engine calls, 120 s for the copy question, so a stuck call never holds the
masked result.

## Copy to your clipboard (opt-in)

With `SECRETS_VEIL_OFFER_COPY=1` in the environment, a masked result also
opens the Claude Code question dialog (`$.ui.ask`): "Copy the masked value to
your clipboard? It goes to your clipboard only; Claude never sees it." The
answers are `Copy to clipboard` and `Keep hidden`. `Copy to clipboard` hands
the first covered value to `$.ui.copy` (OSC 52 in the terminal) and nothing
else: the tool result the model reads stays masked, and the question, the
toast, the status line and the log carry counts only (the copy toast reads
`copied to your clipboard; Claude still sees dots`, with no length). A missing
dialog, a refused or timed-out copy, a question nobody answers within 120 s, or
`Keep hidden` all leave the value covered. The option is off by default because
a dialog on every masked result would be noise.

Measured on CC 2.1.282 (2026-09-25): the model read 8 bullets, the debug log
said `$.ui.copy (secrets-veil): 40 chars, path native, OSC 52 written; copied`,
and the clipboard held 40 bytes.

## What this mod deliberately does not do

- **No reveal to the model.** There is no hover reveal, no `/veil` command,
  no `ui.render`, no `ui.press`, no `command.register`. A reveal path re-arms
  the secret one interaction away from the model and the transcript. The
  opt-in copy above goes to the human's clipboard only.
- **No network, no process, no storage.** Negative pins: `process.run`,
  `http.fetch` and `store.*` are absent from the module. Its `$.ui` calls are
  `notice`, `toast`, `status` and `log`, each carrying counts, never a value,
  plus `ask` and `copy` when the copy offer is opted in; only `copy` ever
  receives a value. `$.clock.after` arms the UI deadlines.
- **No reuse of the unmasked run.** Core 2.1.282 reuses a run's own messages
  when a `tool.call` answer names it by `ref` and its `result` is undefined or
  deep-equal. A masked answer always carries a changed `result`; one without a
  `result` has its `ref` dropped.
- **No names beyond the 21.** The mod reads only the names listed above.

## Why your own variable names are not listed

This is a public repository. A deployment's own variable names are
sensitive even without values: they disclose infrastructure and client
relationships. They cannot be listed in this public mod, and this mod does
not read any config file to collect them.

A team that wants its own names masked should keep a private fork of this
mod, in a private repository, that adds its own literal `$.env.get` call
sites in `hooks/register.ts`. The validator records environment reads
statically, so each name must appear as a string literal at its own call
site. Do not commit that fork's name list anywhere public.

## Layout

- `hooks/register.ts` - session arming and result masking (the only I/O)
- `src/mask.ts` - pure masking logic: table build, patterns, entropy
- `src/types.ts` - shared types, no reveal surface
- `tests/register.test.ts` - drives the shipped hook module
- `tests/mask.test.ts` - pure unit tests, including the 5 ms / 1 MB budget

## Verifying locally

```bash
cd mods/secrets-veil
npm ci
npx tsc --noEmit
claude plugin validate .
npx vitest run
```

Tests use synthetic values built in the test files and non-vendor names
prefixed `VEIL_TEST_`. No real secret value or name appears in this
repository.
