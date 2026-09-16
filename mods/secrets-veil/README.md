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

## What this mod deliberately does not do

- **No reveal UI.** There is no hover reveal, no `/veil` command, no
  `ui.render`, no `ui.press`, no `command.register`. A reveal path re-arms
  the secret one interaction away from the model and the transcript.
- **No network, no process, no storage.** Negative pins: `process.run`,
  `http.fetch`, `store.*`, and `ui.log` are absent from the module.
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
