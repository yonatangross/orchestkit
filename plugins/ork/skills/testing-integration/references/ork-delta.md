# OrchestKit delta: integration and contract testing

House rules that survived the vendor-restatement trim. Everything else about Pact, the Pact
Broker, FastAPI test clients, and generic QA test-plan paperwork lives upstream. See the
"Upstream coverage (do not restate)" table in `SKILL.md`.

## Hold each test tier to its wall-clock budget

Why: House budget carried by the retired plan template. Unit under 30 s, integration under
2 min, E2E under 10 min per PR, full suite under 15 min. A tier that blows its budget gets
split or parallelised, it does not get a longer budget. Distilled from the retired
scripts/test-plan-template.md; no traced incident.
Upstream: `ork:testing-perf` skill (`src/skills/testing-perf`) for pytest-xdist and k6
execution tuning.

## Scale coverage by risk tier on top of the per-area targets

Why: House ladder of critical 100 percent, high 90 percent, medium 80 percent, low 60 percent,
applied over the per-area Coverage Targets table in `SKILL.md`. Payment, auth and delete paths
do not pass at the same bar as UI copy. Distilled from the retired
scripts/test-plan-template.md; no traced incident.
Upstream: `ork:quality-gates` skill (`src/skills/quality-gates`) for complexity scoring and
escalation thresholds.

## Budget API performance at p95 under 500 ms and 1000 req/s sustained

Why: House numbers for a performance-critical endpoint, asserted as thresholds so the load test
fails the run instead of producing a chart nobody reads. Distilled from the retired
scripts/test-plan-template.md; no traced incident.
Upstream: https://grafana.com/docs/k6/latest/using-k6/thresholds/

## Run load tests on main before release, never on every PR

Why: House cost decision. Load-test infrastructure is the one tier whose per-run cost justifies
skipping it on PRs, so it is gated behind a branch filter rather than the default push trigger.
Distilled from the retired scripts/test-plan-template.md; no traced incident.
Upstream: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions

## Never seed a test from production data

Why: House data-privacy rule. Fixtures are anonymised or generated (faker, factories); copying a
production row into `tests/fixtures/` is how PII reaches a repo that is not classified to hold
it. Distilled from the retired scripts/test-plan-template.md; no traced incident.
Upstream: `ork:testing-unit` skill (`src/skills/testing-unit`) for factory and faker patterns.

## Order the contract pipeline: publish, verify, can-i-deploy, deploy, record-deployment

Why: House pipeline shape, kept as checkboxes in `checklists/contract-testing-checklist.md`.
Provider verification depends on the consumer publish job, deploy depends on both, and
`can-i-deploy` runs before deploy so the broker never records a deployment that was not
contract-checked. Reordering any two of these makes the broker's deployment history lie.
Distilled from the retired references/pact-broker.md; no traced incident.
Upstream: https://docs.pact.io/pact_broker/can_i_deploy

## Verify against the broker with pending pacts enabled

Why: House decision recorded in `checklists/contract-testing-checklist.md`. A brand-new consumer
contract must not turn a provider's build red before that provider has implemented it, otherwise
consumers stop publishing contracts early. Distilled from the retired
references/provider-verification.md; no traced incident.
Upstream: https://docs.pact.io/pact_broker/advanced_topics/pending_pacts

## Mount the provider-state setup endpoint only in test and dev builds

Why: House security decision recorded in `checklists/contract-testing-checklist.md`. The state
endpoint is an unauthenticated POST that mutates the database, so it ships as a separate router
registered behind an environment check, never in the production app factory. Distilled from the
retired references/provider-verification.md; no traced incident.
Upstream: https://docs.pact.io/getting_started/provider_states

## House quality budgets on the axes the coverage table does not cover

Why: distilled from the retired `scripts/test-plan-template.md` section 10. The surviving
Coverage Targets table in SKILL.md sets per-area LINE coverage; these are different axes
and none of them conflicts with it, so dropping them lost real budgets rather than
duplicates. Branch coverage target 75% or better, function coverage 85% or better, suite
pass rate 98% or better, bug density under 5 bugs per 1000 lines, full suite under 15
minutes, and 90% of regression tests automated. Numbers a team is measured against cannot
come from a vendor page.
Upstream: none; house quality budgets

## Ten critical user journeys is the E2E coverage count, paired with its wall-clock budget

Why: distilled from the retired `scripts/test-plan-template.md` section 2.1. The E2E tier
budget already recorded elsewhere in this delta is a duration; this is the paired count of
10 critical user journeys. Keeping one without the other lets a suite satisfy the clock by
testing fewer journeys, which is exactly the trade the pair exists to prevent.
Upstream: none; house E2E scope

## Flaky E2E mitigation is a fixed triple: explicit waits, retry logic, isolated test data

Why: distilled from the retired `scripts/test-plan-template.md` section 9 risk table,
where flaky E2E was rated high impact and high likelihood with those three mitigations
named together. The triple is the point: explicit waits alone leave shared-fixture
collisions, and retry logic alone converts a real race into an intermittent pass. No
upstream row in the coverage table carries house flake policy.
Upstream: the in-repo `ork:testing-e2e` skill (`src/skills/testing-e2e/SKILL.md`)
