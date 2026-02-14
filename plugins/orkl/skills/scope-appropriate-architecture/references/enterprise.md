# Enterprise Guide (Tiers 4-5)

Guidance for growth-stage and enterprise production applications.

## Tier 4: Growth-Stage

### When You're Here

- 4-15 developers on the codebase
- $10K-$500K MRR
- 10K-1M monthly active users
- SLAs exist (99.5%+ uptime)
- Compliance requirements emerging

### Architecture: Modular Monolith

```
src/
├── modules/
│   ├── users/
│   │   ├── api/            # Module-scoped routes
│   │   ├── services/       # Business logic
│   │   ├── repository/     # Data access (NOW justified)
│   │   └── types/          # Module types
│   ├── orders/
│   │   ├── api/
│   │   ├── services/
│   │   ├── repository/
│   │   └── types/
│   └── shared/             # Cross-module utilities
├── infrastructure/
│   ├── database/           # Connection, migrations
│   ├── cache/              # Redis client
│   ├── queue/              # Background job client
│   └── monitoring/         # APM setup
└── config/                 # Environment-specific config
```

### Patterns NOW Justified

| Pattern | Why Now |
|---------|---------|
| Repository pattern | Multiple data sources, testability matters |
| DI (light) | Constructor injection for services, no container yet |
| Module boundaries | Team ownership, independent deployment later |
| Background jobs | Email, reports, data sync — can't block requests |
| Redis cache | Database bottlenecks are real and measured |
| Structured logging | Debugging across modules needs correlation |

### Patterns Still OVERKILL

| Pattern | Why Not Yet |
|---------|-------------|
| Microservices | Monolith handles the traffic, operational overhead isn't justified |
| CQRS | Read/write patterns aren't divergent enough |
| Event sourcing | Audit log column is sufficient |
| API gateway | One service, one entry point |
| Service mesh | One service, no mesh needed |
| Custom DI container | Constructor injection is sufficient |

### Database at Growth Stage

- **Primary:** Postgres with connection pooling (PgBouncer or managed)
- **Cache:** Redis for sessions, hot data, rate limiting
- **Background:** Redis-backed queue (BullMQ, Celery)
- **Search:** Postgres full-text or Typesense (if > 100K searchable records)

### Testing Strategy

| Type | Coverage Target |
|------|----------------|
| Unit | Core business logic: 80%+ |
| Integration | All API endpoints, all service methods |
| E2E | Critical user journeys (5-10 flows) |
| Performance | Load test key endpoints (k6 or Artillery) |
| Security | OWASP top 10 scan in CI |

---

## Tier 5: Enterprise

### When You're Here

- 15+ developers, multiple teams
- $500K+ MRR or enterprise contracts
- 1M+ monthly active users
- Strict SLAs (99.9%+ uptime)
- Compliance: SOC2, HIPAA, GDPR, or similar
- Incidents cost real money

### Architecture: Domain-Driven (Hexagonal)

```
src/
├── domains/
│   ├── identity/           # Bounded context
│   │   ├── application/    # Use cases, commands, queries
│   │   ├── domain/         # Entities, value objects, events
│   │   ├── infrastructure/ # Repos, adapters, external services
│   │   └── presentation/   # Controllers, DTOs, serializers
│   ├── billing/
│   │   └── ...
│   └── catalog/
│       └── ...
├── shared/
│   ├── kernel/             # Shared value objects, base classes
│   └── infrastructure/     # Cross-cutting: auth, logging, tracing
├── api-gateway/            # Route to domains
└── workers/                # Background processors per domain
```

### Patterns NOW Justified

| Pattern | Justification |
|---------|--------------|
| Hexagonal / Clean Architecture | Team boundaries align with domain boundaries |
| DDD (bounded contexts) | Complex domain logic requires explicit modeling |
| CQRS | Read and write patterns have diverged significantly |
| Event-driven | Cross-domain communication needs decoupling |
| API gateway | Multiple services, unified entry point |
| Full DI container | Complex dependency graphs across domains |
| RFC 9457 errors | External API consumers need structured errors |
| OpenTelemetry | Distributed tracing across services |

### Justification Required

Even at enterprise scale, these patterns need specific justification:

| Pattern | Only When |
|---------|-----------|
| Microservices extraction | Team can't deploy independently, proven bottleneck |
| Event sourcing | Regulatory audit trail OR temporal query requirements |
| Saga pattern | Multi-service transactions that can't use 2PC |
| Service mesh (Istio) | > 10 services with complex networking needs |
| Custom framework | Existing frameworks demonstrably insufficient |

### Database at Enterprise Scale

- **Primary:** Postgres with read replicas, connection pooling
- **Cache:** Redis Cluster (HA) or Valkey
- **Queue:** RabbitMQ or Kafka (based on throughput needs)
- **Search:** Elasticsearch or OpenSearch (> 1M documents)
- **Analytics:** Data warehouse (BigQuery, Snowflake, ClickHouse)

### Monitoring & Observability

| Layer | Tool |
|-------|------|
| Metrics | Prometheus + Grafana (or Datadog) |
| Tracing | OpenTelemetry + Jaeger (or Datadog APM) |
| Logging | Structured JSON → ELK or Loki |
| Alerting | PagerDuty + Grafana alerts |
| Error tracking | Sentry with release tracking |
| Uptime | Synthetic monitoring (Checkly, Datadog) |
| SLO/SLI | Error budget dashboards |

### Testing Strategy

| Type | Coverage Target |
|------|----------------|
| Unit | 80%+ for domain logic |
| Integration | All service boundaries |
| Contract | API contracts between services |
| E2E | Critical business flows |
| Performance | Load + stress + soak testing |
| Security | SAST + DAST + dependency audit |
| Chaos | Failure injection (Chaos Monkey / Litmus) |
