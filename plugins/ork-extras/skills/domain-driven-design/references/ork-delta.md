# ork delta: domain-driven-design

What this skill knows that the upstream DDD literature does not. Canonical pattern definitions
live upstream (see the "Upstream coverage" table in SKILL.md; the surviving `rules/` files carry
house enforcement only and deliberately have no Upstream lines of their own); what stays
here is the house decision, the ordering constraint, or the numeric budget that a reader cannot
recover from a vendor page.

## Generate entity and event IDs with UUIDv7, never UUIDv4

Why: house decision, because the btree index on the ID column doubles as the recency index, so ork DDD schemas ship no separate `created_at` index for sorting; UUIDv4 scatters inserts across the index and forfeits both that index and the cache locality. Distilled from the retired `checklists/ddd-checklist.md` and `references/entities-value-objects.md`; no traced incident. Correction carried forward: both retired files named the Postgres default `gen_random_uuid_v7()`, which has never existed; PostgreSQL 18 shipped the function as `uuidv7()`.
Upstream: https://www.postgresql.org/docs/18/functions-uuid.html for `uuidv7()`, and https://github.com/aminalaee/uuid-utils for the Python `uuid7()` used for app-generated IDs.

## Drain domain events in the application service after the repository persists

Why: ordering constraint the house code depends on, because aggregate mutation methods only append to `_domain_events` and `collect_events()` is called by the application service after `repo.update()` returns, so a transaction that rolls back never emits; publishing from inside the mutation method emits events for writes that never landed, and subscribers in other contexts cannot un-see them. Distilled from the retired `references/domain-events.md`; no traced incident.
Upstream: https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/domain-events-design-implementation covers the deferred raise-then-dispatch pattern and the before-vs-after-commit trade-off.

## Give every field on a DomainEvent subclass a default, or make the base kw_only

Why: mechanical constraint that shaped the house base class, because `DomainEvent` carries defaulted fields (`event_id`, `occurred_at`), so any subclass field declared without a default raises `TypeError` at class creation; that is why `event_type` is a `ClassVar` (never a dataclass field) and every payload field carries an explicit `field(default_factory=...)`. Distilled from the retired `references/domain-events.md`; no traced incident.
Upstream: https://docs.python.org/3/library/dataclasses.html states the rule ("a field without a default value follows a field with a default value ... whether in a single class, or as a result of class inheritance") and documents `kw_only` as the alternative fix.

## Cross-context reads go through an ACL that returns a frozen local value object

Why: house boundary decision, because Orders holds a `ProductSnapshot` frozen at order time rather than a Catalog `Product`, so a Catalog model change cannot reach the Orders domain and an order keeps the price it was placed at; `shared_kernel/` is deliberately capped at `Money`, `Email`, and `Address` (everything else is duplicated per context on purpose), and ACLs live at `<context>/infrastructure/acl/` so a cross-context import is visible in the path itself. Distilled from the retired `references/bounded-contexts.md`; no traced incident.
Upstream: https://learn.microsoft.com/en-us/azure/architecture/patterns/anti-corruption-layer for the translation-layer pattern and its cost.

## Convert Money to integer minor units inside the payment ACL, never in the domain

Why: house boundary decision plus a live bug in the retired snippet, because the payment gateway wants amounts in the currency's minor unit and the retired ACL hardcoded `int(amount * 100)`; that multiplier is wrong for zero-decimal currencies (JPY takes `500` for 500 yen, not `50000`), so the multiplier must be keyed off the currency, and the whole conversion belongs at the ACL so a vendor encoding never leaks into `Money`. Distilled from the retired `references/bounded-contexts.md`; no traced incident.
Upstream: https://docs.stripe.com/currencies documents the minor-unit convention and lists the zero-decimal currencies.

## Events carry IDs and primitives, never whole entities

Why: house serialization contract, because events are published to a Redis Stream via `XADD`, whose value is a flat field map, so an embedded entity both fails to serialize cleanly and ships mutable state that is already stale by the time a subscriber reads it; the house payload is IDs plus an explicit `{amount, currency}` pair, and event class names stay past tense (`OrderPlaced`, not `PlaceOrder`) because the name is the wire contract other contexts subscribe to. Distilled from the retired `references/domain-events.md`; no traced incident.
Upstream: https://redis.io/docs/latest/commands/xadd/ for the field-map value shape, and the Microsoft domain-events page above for past-tense naming and event immutability.

## Layer the source tree by bounded context first, architectural layer second

Why: house layout, because `src/<context>/{domain,application,infrastructure}` with `shared_kernel/` as a sibling makes an illegal import (`orders.domain` reaching into `catalog.domain`) readable as a path violation in review and in a lint rule, which a layer-first tree (`src/domain/orders`, `src/domain/catalog`) cannot express. Distilled from the retired `references/bounded-contexts.md`; no traced incident.
Upstream: the `architecture-patterns` skill in this plugin owns layered-architecture enforcement and project-structure validation.

## Validate Money in __post_init__: non-negative amount, exactly 3-character currency

Why: distilled from the retired `references/entities-value-objects.md`. The house Money
value object raised `ValueError` on a negative amount and on any currency code whose
length was not 3. The surviving SKILL.md snippet shows the dataclass without
`__post_init__`, so the invariants that make it a value object rather than a named tuple
are currently undocumented. A value object that can hold an invalid value is just a
struct, and no upstream DDD page can supply these two specific checks.
Upstream: https://docs.python.org/3/library/dataclasses.html

## Keep created_at and updated_at on the base Entity, and bump updated_at on every mutation

Why: distilled from the retired `references/entities-value-objects.md`; the base Entity
carried both timestamps and every mutation method (for example `User.activate`,
`User.change_email`) set `updated_at`. This is load-bearing for the UUIDv7 rule above:
the reason a UUIDv7 primary key can replace a dedicated `created_at` sort index is that
`created_at` exists as a column in the first place. Drop the convention and the UUIDv7
rationale stops parsing.
Upstream: none; house entity convention

## Domain events carry the flat four-key envelope

Why: distilled from the retired `references/domain-events.md`; `to_dict()` returned
exactly `{event_id, event_type, occurred_at, payload}` with `occurred_at` in ISO 8601.
Subscribing bounded contexts parse those four keys, so the envelope is a wire contract
between contexts, not an implementation detail. The delta entry above covers the payload
interior; this covers the envelope around it. Redis stream docs describe XADD field pairs
and cannot supply the envelope shape.
Upstream: https://redis.io/docs/latest/commands/xadd/

## Publish to the 'domain-events' stream, and batch publish_all through a pipeline

Why: distilled from the retired `references/domain-events.md`; `domain-events` is the
house default stream name for RedisEventPublisher, and `publish_all` batches through an
async Redis pipeline rather than issuing one round trip per event. The stream name is a
house constant that consumers hardcode, so it is not recoverable from any vendor page,
and the batching is what keeps a large aggregate commit from turning into N network hops.
Upstream: https://redis.io/docs/latest/commands/xadd/

## Domain services: stateless, verb-named, coordinating rather than replacing entity logic

Why: distilled from the retired `checklists/ddd-checklist.md`, and SKILL.md still
advertises a `domain-services` capability, so the guidance has to live somewhere. A
domain service is for an operation that genuinely spans entities, it holds no state, it
is named with a domain verb, and it coordinates entities instead of absorbing their
behaviour. The failure mode this prevents is the anemic model: logic drains out of
entities into services until the entities are data bags.
Upstream: none; house DDD position
