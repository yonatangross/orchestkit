# ork delta: golden-dataset

House numbers and scars kept after the 2026-07-31 wrap-plus-delta thinning of
src/skills/golden-dataset. Generic dataset-management tutorials were removed; the
"Upstream coverage (do not restate)" table in SKILL.md maps every removed topic to its
first-party source. The operational thresholds (quality 0.70, confidence 0.65, tag and
query minimums) live in SKILL.md's Key Decisions table, single-sourced there.

## Store canonical source URLs, never placeholders, in every dataset entry
Why: The retired validation-contracts.md recorded the original scar: entries saved with
placeholder URLs (docs.orchestkit.dev/placeholder/...) could not be re-fetched when
embeddings needed regeneration, broke restore, and left no provenance trail. Canonical
URLs are what make "exclude embeddings from backup, regenerate on restore" (Key
Decisions) possible at all.
Upstream: https://langfuse.com/docs/datasets (dataset item shape and provenance)

## Grade retrieval difficulty on the five-level ladder with expected-score floors
Why: House rubric rescued from the retired curation-diversity.md; without it, difficulty
labels regress to guesses. trivial expects >0.85 retrieval score (direct keyword match),
easy >0.70 (synonyms), medium >0.55 (paraphrased intent), hard >0.40 (multi-hop),
adversarial expects graceful degradation only. Coverage floors from the same file:
tutorials at least 15% of documents, research papers at least 5%, at least 5 documents
per expected domain, hard queries at least 10% and adversarial at least 5% of queries.
Upstream: https://langfuse.com/docs/datasets and ork:testing-llm for evaluation harnesses

## Block additions at 0.90 cosine similarity, warn at 0.85, note at 0.80
Why: House duplicate policy rescued from the retired validation-drift.md, tuned on the
original 98-document dataset: 0.90 blocks, 0.85 warns, 0.80 is informational. Compare
normalized URLs too (lowercase, strip www, trailing slashes, and query strings), and
truncate content to 8000 chars before embedding for the comparison.
Upstream: pgvector cosine-distance docs, https://github.com/pgvector/pgvector

## Do not document infrastructure this repo does not ship
Why: The retired orchestkit-dataset-workflow.md (726 lines), backup-restore-checklist.md
(547 lines), and management-ci.md described a poetry backend at
coding/OrchestKit/backend with a port-5437 postgres, 98 analyses, 415 chunks, and a
91.6% / 0.777 MRR baseline. That app is the pre-plugin OrchestKit and does not exist in
this repository; the numbers are historical, not current truth. Same failure class as
the 2026-06 theater-vs-reality audit. Verify a described path exists at HEAD before
documenting a workflow around it.
Upstream: src/skills/CONTRIBUTING-SKILLS.md (house authoring standard; no vendor owns this rule)
