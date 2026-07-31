# Ork Delta: security-patterns

OrchestKit-specific knowledge rescued when this skill's vendor-restatement files were
removed (wrap + delta campaign, 2026-07-31). Each entry is a floor, scar, or house
decision that upstream documentation will never carry. For everything else, see the
"Upstream coverage (do not restate)" table in SKILL.md.

## Hash passwords with argon2-cffi, never passlib

Why: House correction shipped in this skill's OWASP example files (v2.0.0, February 2026):
passlib last released in 2020 and breaks on Python 3.13+ after PEP 594 removed the stdlib
crypt module. The demos that showed passlib were rewritten to argon2-cffi; this line is
the surviving record of that fix.

Upstream: https://argon2-cffi.readthedocs.io/ and the OWASP Password Storage Cheat Sheet
(https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

## Write Zod v4 API shapes, never v3

Why: security-patterns 2.0.0 (February 2026) standardized every example on Zod v4 after
v3 shapes kept creeping back in from training-data bias. The four traps that fail at
runtime on v4: `z.string().email()/.url()/.uuid()` are removed (use top-level `z.email()`,
`z.url()`, `z.uuid()`); `ZodError.errors` is removed (use `.issues`); the `ZodIssueCode`
enum is removed (issue codes live on `z.core`, pass string codes like `"custom"`);
`z.setErrorMap`/`ZodErrorMap` are removed (pass the unified `error` param per schema, or
`z.config({ customError })` globally).

Upstream: https://zod.dev/v4/changelog (context7: /colinhacks/zod)

## Keep identifiers out of LLM prompts; attribute deterministically after the call

Why: OrchestKit house doctrine, carried through security-patterns since v1: `user_id`,
`tenant_id`, and any UUID flow AROUND the model, never through it, and attribution comes
from RequestContext plus pre-LLM source refs, never from model output. The forbidden
pattern audit and builder implementations live in this skill at
`references/prompt-audit.md` and `scripts/prompt_builder.py`.

Upstream: OWASP LLM01 Prompt Injection (https://genai.owasp.org/llm-top-10/)

## Never bypass this repo's scanning gates with --no-verify

Why: In OrchestKit itself the scanning rules are enforced, not advisory:
`bin/git-hooks/pre-push:324` runs `tests/security/run-security-tests.sh` and
`.github/workflows/ci.yml:162` runs gitleaks, so skipping the hook only relocates a
secret or security failure to CI (repo CLAUDE.md house rule).

Upstream: https://github.com/gitleaks/gitleaks and https://semgrep.dev/docs/
