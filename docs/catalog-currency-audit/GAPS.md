# OrchestKit Gap Register

**Compiled** 2026-07-21 · **Assess verdict at time of writing** FAIL (C, 5.86), security blocker

Every gap below was verified at `file:line` during the audit. Items marked ✅ VERIFIED were reproduced or read directly; items marked 🔬 REPRODUCED were executed live.

---

## ⚠️ RESOLUTION STATUS (read this first)

**Most of this register is CLOSED.** It was compiled *before* remediation and the tables below describe the state at audit time, not now. Merged to `main` as `a1490b022`, 2026-07-21.

| section | status |
|---|---|
| **A. Security** | ✅ closed — A1/A2 `node:20` (0 refs), A4 OWASP 2021→2025, A6 `curl\|sh`, A7 crypto label, A8 `passlib`→`argon2-cffi`, A9 pyjwt floor, A10 Argon2id. **A5 supply-chain** shipped as `security-patterns/rules/supply-chain.md` |
| **B. Correctness** | ✅ closed — B1/B2 `gh` flags (0 live usages), B3-B6 Storybook (0 `@storybook/test`), B7 Pydantic v2, B8 Tailwind v4, B9 `motion` rename, B10 `gemini-2.5-pro` (0 refs) |
| **C. Consistency** | ✅ closed — C1 LangGraph unified on 1.2. C2-C5 re-examined and found to be **legitimate history**, not drift (see below) |
| **D. Stale** | ✅ closed — D1 guide deleted, D3 superlatives replaced with an alias pointer |
| **E. Detection** | ✅ closed — E1 `test-model-recency.sh`, E2 `test-targets-floor-agreement.mjs`, E3 resolved |
| **F. Eval harness** | 🟡 partial — F2 budget governor shipped. F1/F3 remain open |

### A3 was a FALSE POSITIVE, do not "fix" it

A3 claimed 3 of 5 OWASP IDs were mis-mapped in `owasp-top10-fixes.md`. **They were already correct.** That file is explicitly built on OWASP Top 10:**2025** (its title and body say so); the finding was validated against the **2021** list by mistake. Renumbering would have introduced the bug. A remediation agent correctly refused this instruction.

### C2-C5 are mostly legitimate history

A later pass found the remaining Playwright 1.58 / Biome 2.0 / pgvector 0.7 references are a link to release notes and "feature landed in version X" statements, not competing floors. A prose-based detector for this was built, measured at near-zero precision, and **deleted rather than shipped**. `test-targets-floor-agreement.mjs` checks only `targets:` frontmatter, which is unambiguous.

### Still open

| # | gap | why |
|---|---|---|
| F1 | `implement` trigger recall never measured | needs a run; see the routing caveat below |
| F3 | 36 agent eval specs, 0 workflows reference them | cost decision, not code |
| — | 37 model-recency, 7 collisions, 15 unreachable | all **ratcheted**, can only improve |
| — | `assess-verdict.json` holds a foreign assessment | needs a merge/discard call |

### ⚠️ Caveat on the whole trigger-eval direction

2026 routing research (SkillRouter, Alibaba 2026-04; *Multi-Agent Routing as Set-Valued Prediction*, arXiv 2606.28925) finds routing keys on the skill **body** more than metadata, and is **set-valued multi-label** rather than per-skill binary. The "trigger contradictions" check in `test-skill-coverage.sh` therefore encodes the wrong model: a prompt legitimately claimed by two skills is normal, not a defect. It reports 0 today. Drop or invert it before it fires.

---

## A. Security blocker (assess `min_blocker` breach, security 3.8 / 4.0)

| # | Gap | Location | Evidence | Fix |
|---|---|---|---|---|
| A1 | EOL `node:20-alpine` **digest-pinned**, can never take a security patch | `src/skills/devops-deployment/scripts/Dockerfile:3,13,27` | ✅ Node 20 EOL 2026-04-30 | Bump to `node:24-alpine`, re-pin digest |
| A2 | EOL `node:20` as build target | `src/skills/devops-deployment/rules/docker-multistage.md:29,35,43`, `rules/docker-layer-security.md:15,33`, `references/docker-patterns.md:11,19,29`, `src/skills/performance/references/cdn-setup.md:351,359` | ✅ | Bump to `node:24-alpine` |
| A3 | 3 of 5 OWASP IDs mapped to **wrong categories** in the file agents load to classify findings | `src/skills/security-patterns/examples/owasp-top10-fixes.md:25,49,64` | ✅ A02=Crypto, A03=Injection, A04=Insecure Design | Correct the ID→category map |
| A4 | Security agent audits against **OWASP Top 10 (2021)**, superseded Nov 2025 | `src/agents/security-auditor.md:144,191`, `src/skills/audit-full/rules/finding-severity-classification.md:53` | ✅ | Migrate to OWASP Top 10:2025 |
| A5 | **A03:2025 Software Supply Chain Failures** has ~no coverage | `security-patterns/**`, `audit-full/**`, `security-auditor.md`, `ai-safety-auditor.md` (1 file total) | ✅ | Add supply-chain rule (SBOM, SLSA, sigstore, typosquat) |
| A6 | `curl \| sh` recommended, while the repo's own config lists that exact shape as never-run | `src/skills/llm-integration/rules/local-ollama-setup.md:14` vs `src/skills/configure/references/cc-version-settings.md:790` | ✅ self-contradiction | Use checksum-verified install; canonical host is `ollama.com` |
| A7 | Unsalted single-round SHA-256 under a **"Safe password comparison"** heading | `src/skills/security-patterns/references/vulnerability-demos.md:371-380` | ✅ contradicts own `rules/owasp-injection.md:153` | Relabel: the safe part is `compare_digest`, not the hash |
| A8 | `passlib` recommended; unmaintained since 2020, breaks on Python 3.13+ (PEP 594) | `security-patterns/examples/owasp-top10-fixes.md:59`, `references/vulnerability-demos.md:383`, `code-review-playbook/references/review-patterns.md:199`, `architecture-patterns/rules/right-sizing-decision.md:17` | ✅ | Use `argon2-cffi` directly (SKILL.md:55 already does) |
| A9 | Remediation example recommends a CVE-bearing floor | `src/agents/security-auditor.md:158` (`pyjwt 2.8.0+`, CVE-2024-53861 fixed in 2.10.1) | ⚠️ `+` does admit 2.10.1 | Raise example floor to 2.10.1 |
| A10 | `bcrypt cost=12` hardcoded against own `Argon2id > bcrypt` rule; 72-byte truncation unmentioned | `src/agents/backend-system-architect.md:149,276`, `python-backend/checklists/fastapi-production-checklist.md:121` | ✅ | Prefer Argon2id, note bcrypt 72-byte limit |

## B. Correctness — guidance that does not run

| # | Gap | Location | Evidence | Fix |
|---|---|---|---|---|
| B1 | `gh pr view --json statusCheckRollupState` → **Unknown JSON field** | `github-operations/references/pr-workflows.md:94,201,269`, `examples/automation-scripts.md:66`, `SKILL.md:144`, `test-cases.json:24` | 🔬 REPRODUCED gh 2.96.0 | Use `statusCheckRollup` |
| B2 | `gh pr checks --json conclusion` → **Unknown JSON field** | `github-operations/references/pr-workflows.md:81,84` | 🔬 REPRODUCED | Use `bucket,link,name` (as `ci-debug/SKILL.md:50` already does) |
| B3 | `@storybook/test` removed in SB9, taught as the migration **target** (9 wrong vs 3 correct) | `storybook-testing/references/storybook-migration-guide.md:42,48,126,136`, `rules/storybook-play-functions.md:33`, `rules/storybook-a11y-testing.md:34`, `rules/storybook-sb-mock.md:35,45`, `ui-components/rules/storybook-component-docs.md:51` | ✅ own table at `storybook-addon-ecosystem.md:75` states the right answer | `storybook/test` |
| B4 | `@storybook/test-runner` removed SB9 | `ai-ui-generation/rules/ai-ci-gate.md:75` | ✅ | `@storybook/addon-vitest` |
| B5 | Installs addons the same file says are bundled in core | `storybook-testing/references/storybook-addon-ecosystem.md:5 vs 17,25,26,27,53-57,80-82` | ✅ self-contradiction within 80 lines | Remove separate installs |
| B6 | `docs: { autodocs: 'tag' }` main.ts key removed in SB8 | `storybook-addon-ecosystem.md:61` | ✅ contradicts own `rules/storybook-autodocs.md:93` | `tags: ['autodocs']` |
| B7 | Pydantic **v1** API in good-path examples while catalog mandates v2 | `api-design/examples/fastapi-versioning.md:312`, `references/rest-patterns.md:397`, `rules/framework-resource-modeling.md:79` | ✅ | `model_validate` / `model_dump` |
| B8 | Tailwind **v3** config offered as "(Recommended)" against own v4 rule | `design-context-extract/SKILL.md:79,135,226`, `design-to-code/SKILL.md:141` vs `ui-components/rules/tailwind-v4-patterns.md:10,29` | ✅ v4 ignores `tailwind.config.js` | CSS-first `@theme` |
| B9 | `targets:` pins renamed package | `animation-motion-design/SKILL.md:16-17` (`framer-motion`) | ✅ examples already import `motion/react` | `motion >=12` |
| B10 | `gemini-2.5-pro` recommended while same skill recommends `gemini-3.1-pro-preview` | `multimodal-llm/rules/audio-speech-to-text.md:47`, `rules/vision-image-analysis.md:75`, `agents/multimodal-specialist.md:106` | ✅ latest GA is Gemini 3.5 Flash | `gemini-3.1-pro-preview` |
| B11 | `--bare` auth premise contradicted in-repo | `configure/references/cc-version-settings.md:203`, `bare-eval/SKILL.md:37` vs `ci-sentinel/SKILL.md:107` | ✅ | Reconcile; `ci-sentinel` has the field-tested answer |

## C. Internal version disagreements (no external research needed)

| # | Gap | Values | Location |
|---|---|---|---|
| C1 | LangGraph floor, **4 different values** | 1.2 / 1.1 / 1.0.6 / 1.0 | `langgraph/SKILL.md:17` vs `:175`, `agent-orchestration/references/langgraph-implementation.md:3`, `agents/workflow-architect.md:57` |
| C2 | Playwright | 1.59 vs 1.58 | `testing-e2e/SKILL.md:31` vs `test-cases.json:52`, `references/visual-regression.md:326` |
| C3 | Biome | 2.4 vs 2.0 | `code-review-playbook/rules/linting-biome-rules.md:54` vs `test-cases.json:47` |
| C4 | pgvector, **same file** | 0.8+ vs 0.7+ | `rag-retrieval/rules/pgvector-indexing.md:31` vs `:75,77` |
| C5 | React | 19 vs 18 | catalog-wide vs `json-render-catalog/references/package-ecosystem.md:20` |

## D. Stale / expiring content

| # | Gap | Location | Note |
|---|---|---|---|
| D1 | Upgrade guide **160 releases** behind the 2.1.206 floor | `upgrade-assessment/references/cc-2.1.47-upgrade-guide.md` | Delete or rewrite |
| D2 | Promo price expires **2026-08-31** (~6 weeks) | `analytics/references/cost-estimation.md:16` | Add expiry handling |
| D3 | "current latest Opus/Sonnet" superlatives, self-expiring | `upgrade-assessment/rules/knowledge-compatibility.md:24,27` | Point at `aliases` instead of naming a model |
| D4 | `claude-sonnet-4-6` × 86 refs: valid but not latest | 37 files | Judgment call, not a sweep |
| D5 | EOL Python floor in a review checklist | `code-review-playbook/checklists/code-review-checklist.md:288` (`Python 3.7+`) | Raise to 3.11+ |

## E. Missing detection (the reason the above accumulated silently)

| # | Gap | Detail | Leverage |
|---|---|---|---|
| E1 | **No model-recency test** | `models.vocab.json` carries `aliases` = "shortName → current latest full ID per channel". Grep for `aliases` across `tests/` returns **one comment**. Every consumer reads only `fullIds`/`historicalIds`/`shortNames` membership. | 🥇 highest — one $0 test |
| E2 | No cross-file dependency-floor consistency test | C1-C5 would all be caught by one | 🥈 |
| E3 | No superlative/expiry lint | D2, D3 | 🥉 |

## F. Eval-harness gaps (from earlier in session)

| # | Gap | Status |
|---|---|---|
| F1 | `implement`'s recall never measured | Needs a PR touching `implement`; blocked on quota |
| F2 | No budget governor; harness burns quota on runs it cannot finish | $0 to build, prerequisite for any paid tier |
| F3 | 36 agent eval specs + working runner, referenced by **zero** workflows | Costs quota; gate behind F2 |
| F4 | 9 of 36 agents have no skill `subagent_type=` wiring | Informative only — telemetry shows all 36 fired |
| F5 | 7 description collisions, 15 unreachable skills | Baselined by `test-skill-coverage.sh` ratchet |
| F6 | `.claude/chain/assess-verdict.json` holds a foreign assessment | Needs an explicit merge/discard decision |

---

## Do NOT change

Verified correct; a naive sweep would damage them.

| Item | Why it looks stale but is not |
|---|---|
| `Next.js 15` × 17 | Migration guides: "upgrading 15 to 16", "Before (Next.js 15)" |
| `Node.js 18` × 5 | Historical CC changelog entries, a changelog FORMAT example, a min-version requirement |
| `TeamCreate` × 8 files | All say **"no TeamCreate"** — correctly documenting removal |
| `claude-sonnet-4` "94 refs" | Substring inflation; 6 real refs |
| `FastAPI v2.0` | A mermaid diagram node label, not a claim |
| `gpt-5.5`, Kling 3.0, Sora 2, Veo 3.1, Runway Gen-4.5 | All current as of 2026-07 |
| `gemini-3.1-pro-preview` | Correct; 3.1 Pro is in preview |
