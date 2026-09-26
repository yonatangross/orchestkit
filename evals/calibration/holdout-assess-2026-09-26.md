# Skill holdout grader baseline, assess, 2026-09-26

Grader: claude-opus-5-5[1m]. Mode: champion-vs-champion scaffold (no challenger).
Seal: sha256:a84112128cbf... (7 cases). Decision: ACCEPTED (incumbent retained).

| dimension | champ | chall | delta |
|---|---:|---:|---:|
| correctness | 6.57 | 6.57 | 0.00 |
| maintainability | 5.71 | 5.71 | 0.00 |
| performance | 4.57 | 4.57 | 0.00 |
| security | 6.00 | 6.00 | 0.00 |
| scalability | 5.00 | 5.00 | 0.00 |
| testability | 6.14 | 6.14 | 0.00 |
| compliance | 5.57 | 5.57 | 0.00 |
| COMPOSITE | 5.726 | 5.726 | 0.000 |

Dry-run estimate before spend: 7 cases, 14 grader calls, est USD 0.58 bare / 1.16 with 2x fudge (under the $10 gate). Ran on Max plan OAuth after Dev and Prod API keys returned credit-balance-too-low.

Script fixes landed with this baseline so the grader pin is real: pass `--model` into the holdout `claude -p` calls, and read `.target` from assess holdout.jsonl.
