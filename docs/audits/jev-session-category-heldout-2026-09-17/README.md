# Session category eval, held out: Jev vs haiku on the same criteria (2026-09-17)

Evidence record for the opt-in shadow session category provider shipped dormant in #4208.
No product code changes in this record.

## Verdict

With the SAME category criteria, Jev (`jev-1.13.0`, one typed Choice) and haiku (`claude -p`)
tie on accuracy: 120/150 = 80.0% vs 119/150 = 79.3%, McNemar p=1.0. Jev passes the kill
criterion and is about 58x faster with about 34x fewer input tokens. The accuracy gain over
today's haiku prompt came from the rewritten criteria, not from the model.

## Setup

- **Rows:** 150 held-out sessions, 0 overlap with the 80 sessions used while writing the criteria.
- **Labels:** a blind reader (Opus) labelled each row from its branch and first prompt, using the
  same `criteria-B.json` rubric the models got. 129 sure, 21 unsure.
- **Criteria:** `criteria-B.json`, nine options, each with `what`, `not_for` and `examples`.
- **Candidate:** Jev B, `run_jev_b.mjs`. **Control:** haiku with the same criteria and question,
  `run_haiku_b.mjs`, using the product's stripped child context. **Baseline:** the haiku category
  already stored for each session by today's short prompt.
- **Errors:** Jev 0/150, haiku 1/150.

## Accuracy vs the hand labels (9 categories)

| Classifier | All rows | Sure rows |
|---|---|---|
| haiku today (stored, short prompt) | 98/150 = 65.3% | 85/129 = 65.9% |
| haiku B (control, same criteria) | 119/150 = 79.3% | 107/129 = 82.9% |
| Jev B (candidate) | 120/150 = 80.0% | 109/129 = 84.5% |

- McNemar Jev B vs haiku B: Jev-only right 11, haiku-only right 10, p=1.0 (a tie).
- McNemar Jev B vs haiku today: 40 vs 18, p=0.0054.
- Kill criterion (fixed before any run): Jev more than 5 points under haiku, or p95 above 1,000 ms.
  Result: gap +0.7 points, p95 399 ms. **Not killed.**

## Service

| | p50 | p95 | Mean input tokens |
|---|---|---|---|
| Jev B | 319 ms | 399 ms | 1,341 |
| haiku B (`claude -p`) | 15.5 s | 23.2 s | 45,073 |

The 150 haiku control calls cost 7.97 USD at list price (about 0.053 USD per session).

## Jev confidence

| Confidence | Rows | Correct |
|---|---|---|
| below 0.5 | 17 | 6 |
| 0.5 to below 0.8 | 40 | 27 |
| 0.8 and above | 93 | 87 (93.5%) |

Cascade (Jev when confidence is 0.8 or above, else haiku B): 121/150, with haiku still needed on
57 of 150 rows.

## The ninth `review` option

10 of 150 hand rows are `review`. Jev picked it 15 times, 10 correct (recall 10/10, precision
10/15). Haiku B picked it 14 times, 9 correct. Folding `review` into `testing` changes accuracy
by under 1 point for either model (Jev 80.0% to 80.7%), so this set does not need the ninth
option for accuracy.

## Caveats

1. The labeller read the same `criteria-B.json` the models got. That is fair between the two
   models, but it inflates both against the short prompt behind "haiku today", so 65.3% is not
   an apples-to-apples model comparison.
2. The labels come from one Opus reader, not a human.
3. The criteria were derived from an earlier A/B pass; this held-out run validates them out of
   sample exactly once.

## Reproduce

Row files (`heldout-150*.jsonl`) contain private prompt text and are not committed.

1. `python3 export_heldout.py --exclude <rows-used-for-tuning.jsonl> --limit 150 --out heldout-150.jsonl`
2. Label the rows blind into `heldout-150-hand.jsonl` (`{"id","hand","unsure"}` per line).
3. `export ORK_TYPESAFE_API_KEY=...` then `./run.sh jev`; `./run.sh haiku` (needs a logged-in `claude`).
4. `python3 score.py` writes `results.json`.
