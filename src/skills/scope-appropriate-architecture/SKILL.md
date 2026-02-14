---
name: scope-appropriate-architecture
license: MIT
compatibility: "Claude Code 2.1.34+"
description: "Right-sizes architecture to project scope. Prevents over-engineering by classifying projects into 6 tiers and constraining pattern choices accordingly. Use when designing architecture, selecting patterns, or when brainstorming/implement detect a project tier."
tags: [architecture, yagni, over-engineering, scope, patterns]
version: 1.0.0
author: OrchestKit
user-invocable: false
complexity: low
metadata:
  category: architecture
---

# Scope-Appropriate Architecture

Right-size every architectural decision to the project's actual needs. Not every project needs hexagonal architecture, CQRS, or microservices.

**Core principle:** Detect the project tier first, then constrain all downstream pattern choices to that tier's complexity ceiling.

---

## The 6 Project Tiers

| Tier | LOC Ratio | Architecture | DB | Auth | Tests |
|------|-----------|-------------|-----|------|-------|
| **1. Interview/Take-home** | 1.0-1.3x | Flat files, no layers | SQLite / JSON | None or basic | 8-15 focused |
| **2. Hackathon/Prototype** | 0.8-1.0x | Single file if possible | SQLite / in-memory | None | Zero |
| **3. Startup/MVP** | 1.0-1.5x | MVC monolith | Managed Postgres | Clerk/Supabase Auth | Happy path + critical |
| **4. Growth-stage** | 1.5-2.0x | Modular monolith | Postgres + Redis | Auth service | Unit + integration |
| **5. Enterprise** | 2.0-3.0x | Hexagonal/DDD | Postgres + queues | OAuth2/SAML | Full pyramid |
| **6. Open Source** | 1.2-1.8x | Minimal API surface | Configurable | Optional | Exhaustive public API |

**LOC Ratio** = total lines / core business logic lines. Higher ratio = more infrastructure code relative to business value.

---

## Auto-Detection Signals

| Signal | Tier Indicator |
|--------|---------------|
| README contains "take-home", "assignment", "interview" | Tier 1 |
| Time limit mentioned (e.g., "4 hours", "weekend") | Tier 1-2 |
| < 10 files, no CI, no Docker | Tier 1-2 |
| `.github/workflows/` present | Tier 3+ |
| `package.json` with 20+ dependencies | Tier 3+ |
| Kubernetes/Terraform files present | Tier 4-5 |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | Tier 6 |
| Monorepo with `packages/` or `apps/` | Tier 4-5 |

**When confidence is low:** Ask the user with `AskUserQuestion`.

---

## Pattern Appropriateness Matrix

| Pattern | Interview | Hackathon | MVP | Growth | Enterprise |
|---------|-----------|-----------|-----|--------|------------|
| Repository pattern | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE | REQUIRED |
| Event-driven arch | OVERKILL | OVERKILL | OVERKILL | SELECTIVE | APPROPRIATE |
| DI containers | OVERKILL | OVERKILL | LIGHT ONLY | APPROPRIATE | REQUIRED |
| Separate DTO layers | OVERKILL | OVERKILL | 1 EXTRA | 2 LAYERS | ALL LAYERS |
| Microservices | NEVER | NEVER | NEVER | EXTRACT ONLY | APPROPRIATE |
| CQRS | OVERKILL | OVERKILL | OVERKILL | OVERKILL | WHEN JUSTIFIED |
| Hexagonal architecture | OVERKILL | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE |
| DDD (bounded contexts) | OVERKILL | OVERKILL | OVERKILL | SELECTIVE | APPROPRIATE |
| Message queues | OVERKILL | OVERKILL | BORDERLINE | APPROPRIATE | REQUIRED |
| API versioning | SKIP | SKIP | URL prefix | Header-based | Full strategy |
| Error handling | try/catch | console.log | Error boundary | Error service | RFC 9457 |
| Logging | console.log | none | Structured JSON | Centralized | OpenTelemetry |

**Rule of thumb:** If a pattern shows OVERKILL for the detected tier, do NOT use it. Suggest the simpler alternative instead.

---

## Technology Quick-Reference by Tier

| Choice | Interview | Hackathon | MVP | Growth | Enterprise |
|--------|-----------|-----------|-----|--------|------------|
| **Database** | SQLite / JSON file | In-memory / SQLite | Managed Postgres | Postgres + Redis | Postgres + queues + cache |
| **Auth** | Hardcoded / none | None | Clerk / Supabase Auth | Auth service | OAuth2 / SAML / SSO |
| **State mgmt** | useState | useState | Zustand / Context | Zustand + React Query | Redux / custom + cache |
| **CSS** | Inline / Tailwind | Tailwind | Tailwind | Tailwind + design tokens | Design system |
| **API** | Express routes | Single file handler | Next.js API routes | FastAPI / Express | Gateway + services |
| **Deployment** | localhost | Vercel / Railway | Vercel / Railway | Docker + managed | K8s / ECS |
| **CI/CD** | None | None | GitHub Actions basic | Multi-stage pipeline | Full pipeline + gates |
| **Monitoring** | None | None | Error tracking only | APM + logs | Full observability stack |

---

## Build vs Buy Decision Tree (Tiers 1-3)

For Interview, Hackathon, and MVP tiers, **always prefer buying over building**:

| Capability | BUY (use SaaS) | BUILD (only if) |
|-----------|----------------|-----------------|
| Auth | Clerk, Supabase Auth, Auth0 | Core product IS auth |
| Payments | Stripe | Core product IS payments |
| Email | Resend, SendGrid | Core product IS email |
| File storage | S3, Cloudflare R2 | Compliance requires on-prem |
| Search | Algolia, Typesense Cloud | > 10M docs or custom ranking |
| Analytics | PostHog, Mixpanel | Unique data requirements |

**Time savings:** Auth alone is 2-4 weeks build vs 2 hours integrate.

---

## Upgrade Path

When a project grows beyond its current tier, upgrade incrementally:

```
Tier 2 (Prototype) → Tier 3 (MVP)
  Add: Postgres, basic auth, error boundaries, CI

Tier 3 (MVP) → Tier 4 (Growth)
  Add: Redis cache, background jobs, monitoring, module boundaries

Tier 4 (Growth) → Tier 5 (Enterprise)
  Add: DI, bounded contexts, message queues, full observability
  Extract: First microservice (only the proven bottleneck)
```

**Key insight:** You can always add complexity later. You cannot easily remove it.

---

## When This Skill Activates

This skill is loaded by:
- `brainstorming` Phase 0 (context discovery)
- `implement` Step 0 (context discovery)
- `quality-gates` YAGNI check
- Any skill that needs to right-size a recommendation

The detected tier is passed as context to constrain downstream decisions.

---

## Related Skills

- `brainstorming` - Uses tier detection in Phase 0 to constrain ideas
- `implement` - Uses tier detection in Step 0 to constrain architecture
- `quality-gates` - YAGNI gate references this skill's tier matrix
- `architecture-patterns` - Architecture validation (constrained by tier)

---

## References

- [Interview & Take-Home Guide](references/interview-takehome.md) - Tiers 1-2 in detail
- [Startup & MVP Guide](references/startup-mvp.md) - Tier 3 patterns and decisions
- [Enterprise Guide](references/enterprise.md) - Tiers 4-5 patterns and justification criteria
- [Open Source Guide](references/open-source.md) - Tier 6 unique considerations
