---
paths:
  - "src/skills/**"
---

# Skill Authoring Rules

## SKILL.md Format
- **Max 500 lines** (< 400 preferred for prompt cache efficiency)
- Required frontmatter: `name`, `description`, `version`, `author`, `user-invocable`, `complexity`, `tags`
- Description must include **WHAT** (capabilities) + **WHEN** (trigger conditions) in third person
- At least 1 code example block required
- Token budget: 200-5000 tokens per skill

## Rules Subdirectory (rules/*.md)
- Individual rule files: 40-100 lines each (max 150)
- Filename format: `area-prefix-name.md` (kebab-case)
- Each needs frontmatter: `title`, `impact`, `impactDescription`, `tags`
- Include incorrect/correct code pairs in every rule
- Filter: "Would Claude make this mistake without this rule?" — if NO, skip it
- Max ~25 supporting files per skill

## Version and API Claims Must Be Machine-Checkable

Prose rots silently. A claim about the outside world belongs somewhere a script can verify it.

- **A requirement claim goes in frontmatter, not prose.** "Needs at least X" belongs in
  `targets: [{library, version}]`. "The release we actually read" belongs in
  `upstream-version-tested:`. These are different numbers and mean different things: a floor is
  satisfied by any newer release, a pin is not.
- **Add the library to `LIBRARY_REGISTRY`** in `scripts/lib/registry-resolve.mjs` when you declare
  a new `targets:` entry, including a `{registry, pkg}` alias when the published package name
  differs from the name you declared. An unmapped library reports SKIP forever — a hole that reads
  as coverage. If a package genuinely cannot be resolved (k6 ships as a Go binary), leave it
  unmapped with a comment saying why; an honest SKIP beats a confidently wrong answer.
- **Every symbol in an import must actually be exported.** Before writing
  `import { X } from "pkg"`, confirm `X` appears in the package's published type declarations
  (`curl -fsS https://cdn.jsdelivr.net/npm/<pkg>@<version>/dist/index.d.ts`) or, for Python, in
  upstream source. This rule exists because `LangfuseExporter` shipped in four files and has never
  existed at any version of `@langfuse/otel` — no version gate can catch a symbol that was never
  published.
- **Verify a replacement package exists before documenting it.** `@langfuse/vercel` was documented
  for months and was never published. One `curl registry.npmjs.org/<pkg>/latest` prevents trading
  one phantom for another.
- **EXEMPT: historical and citation prose.** "Deprecated in v1.0", "landed in 0.7", and links to
  release notes are legitimate and must not be rewritten to look current. A lexical scan cannot
  separate "requires >= X" from "feature Y landed in X" — that is why the floor gate reads
  frontmatter only (see the header comment in `tests/skills/structure/test-targets-floor-agreement.mjs`).
- **Distinguish version axes.** One product can have several. Langfuse has three: the Python SDK
  (4.x), the JS/TS SDK (5.x), and the self-hosted platform (v3). "Correcting" one into another
  breaks accurate documentation.

## After Changes
- Update `manifests/ork.json` if adding/removing skills
- Run: `npm run build && npm run test:skills`
- Check internal links to `references/`, `rules/`, `scripts/` before commit
- If you added or changed a `targets:` floor, run `node scripts/check-labs-versions.mjs`
- If the skill has a `rules/` dir, update `rules/_sections.md` in the SAME change — it drifted by
  9 rules and a whole category before anyone noticed
- See `src/skills/CONTRIBUTING-SKILLS.md` for full authoring standards
