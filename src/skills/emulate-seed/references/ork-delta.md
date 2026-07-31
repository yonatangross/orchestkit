# emulate-seed: the ork delta

What this skill knows that emulate's own documentation does not. Everything else
(endpoint lists, per-service curl recipes, OAuth walkthroughs, the programmatic API
surface) lives upstream and is deliberately not restated here. See the
"Upstream coverage (do not restate)" table in `SKILL.md` for where each topic went.

Every claim below was checked against the published `emulate@0.9.0` type
declarations on 2026-07-31, which is also this skill's `upstream-version-tested`.

## Import `createEmulator` from `emulate`, never `createEmulate` from `@emulators/emulate`
Why: the retired `sdk-patterns.md` reference used `createEmulate` from `@emulators/emulate` in every snippet and `rules/parallel-ci.md` copied it, but `@emulators/emulate` returns 404 on the npm registry and `emulate@0.9.0` `dist/api.d.ts` exports exactly one factory, `createEmulator`, so none of those snippets could ever have run. Same failure class the house rule in `.claude/rules/skill-authoring.md` calls out: every symbol in an import must actually be exported.
Upstream: https://cdn.jsdelivr.net/npm/emulate@0.9.0/dist/api.d.ts

## Pass `seed` to `createEmulator` as a parsed object, not a YAML path
Why: `EmulatorOptions.seed` is typed `SeedConfig` (an object with a `tokens` map plus per-service keys) in `emulate@0.9.0` `dist/api.d.ts`; only the CLI `--seed` flag takes a file path. The retired `sdk-patterns.md` passed `seed: './emulate.config.yaml'` in six snippets, which type-errors before a test ever starts. Read and parse the YAML yourself, or drive the emulator from the CLI.
Upstream: https://cdn.jsdelivr.net/npm/emulate@0.9.0/dist/api.d.ts

## Point app code at the emulator with `*_API_BASE`, not the vendor's `*_EMULATOR_URL`
Why: house convention. `references/cli-reference.md`, the CI snippet in `SKILL.md`, and every expectation in `test-cases.json` key on `GITHUB_API_BASE`, `VERCEL_API_BASE`, and `GOOGLE_OAUTH_BASE`, while the vendor docs use `GITHUB_EMULATOR_URL` and friends. Copying a variable name out of a vendor snippet leaves the SDK silently pointed at production instead of failing loudly.
Upstream: references/upstream.md, section "Pointing Your App at the Emulator"

## Translate dep-map emulator labels into emulate service ids before passing `--service`
Why: `references/dep-to-emulator-map.json` emits ork's own labels `google-oauth`, `apple-auth`, and `microsoft-entra`, but `emulate@0.9.0`'s `SERVICE_NAME_LIST` is vercel, github, google, slack, apple, microsoft, okta, aws, resend, stripe, mongoatlas, clerk, linear, twilio. Anything `scripts/auto-discover.sh` writes for those three needs mapping before it reaches the CLI or is used as a `SeedConfig` key, or emulate will not recognize the service.
Upstream: https://cdn.jsdelivr.net/npm/emulate@0.9.0/dist/api.d.ts

## Do not vendor-sync emulate's per-service SKILL.md files into this skill
Why: the retired `upstream-github.md`, `upstream-google.md`, and `upstream-vercel.md` were 1133 lines of verbatim output from the repo-root `sync-vercel-skills.sh` covering 3 of the 14 emulators, so they read as full coverage while going stale on every emulate release, and they duplicated `references/upstream.md`. Distilled from those three retired files; no traced incident.
Upstream: https://github.com/vercel-labs/emulate/tree/main/skills
