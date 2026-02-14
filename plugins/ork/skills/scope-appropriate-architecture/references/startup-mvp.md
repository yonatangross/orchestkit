# Startup & MVP Guide (Tier 3)

Guidance for MVPs, early-stage startups, and small production applications.

## Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Files | 20-60 | > 120 |
| LOC | 2,000-8,000 | > 15,000 |
| Tests | Happy path + critical edges | > 200 tests |
| Dependencies | 10-25 | > 50 |
| Deploy time | < 10 min | > 30 min |
| Time to first user | 2-6 weeks | > 12 weeks |

## Architecture: MVC Monolith

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (thin handlers)
│   ├── (auth)/             # Auth-gated pages
│   └── (public)/           # Public pages
├── lib/
│   ├── db.ts               # Database client (Drizzle/Prisma)
│   ├── auth.ts             # Auth config (Clerk/Supabase)
│   └── email.ts            # Email client (Resend)
├── components/             # React components
├── actions/                # Server actions (business logic)
└── types/                  # Shared types
```

### Key Principles

1. **Monolith first.** Always. No exceptions.
2. **Managed services.** Database, auth, email, storage — all SaaS.
3. **One deployment target.** Vercel OR Railway, not both.
4. **Feature flags over branches.** Ship incomplete features behind flags.
5. **Server actions over API routes.** Less boilerplate, same safety.

## Build vs Buy at MVP Scale

| Decision | Recommendation | Time Saved |
|----------|---------------|------------|
| Auth | BUY: Clerk (2h) vs BUILD: JWT + sessions (2-4w) | 2-4 weeks |
| Payments | BUY: Stripe Checkout (4h) vs BUILD: custom (4-8w) | 4-8 weeks |
| Email | BUY: Resend (1h) vs BUILD: SMTP + templates (1-2w) | 1-2 weeks |
| File upload | BUY: UploadThing/S3 (2h) vs BUILD: custom (1-2w) | 1-2 weeks |
| Search | BUY: Postgres full-text (0h) vs BUILD: Elasticsearch (2-4w) | 2-4 weeks |
| Analytics | BUY: PostHog (1h) vs BUILD: custom (2-4w) | 2-4 weeks |

**Total potential savings: 12-24 weeks** by choosing BUY for non-core features.

## Database Decisions

- **Default choice:** Managed Postgres (Supabase, Neon, Railway)
- **ORM:** Drizzle (type-safe, lightweight) or Prisma (broader ecosystem)
- **Migrations:** ORM-managed, not manual SQL
- **Caching:** None initially. Add Redis only after measuring bottlenecks.

### What NOT to Do

- No read replicas (you don't have the traffic)
- No database-per-service (you have one service)
- No custom connection pooling (managed service handles it)
- No event sourcing (your audit needs are met by `updated_at` columns)

## Testing Strategy

| Type | Coverage | Priority |
|------|----------|----------|
| Unit tests | Business logic functions | HIGH |
| Integration | API routes / server actions | HIGH |
| E2E | Critical user flows (signup, purchase) | MEDIUM |
| Performance | None yet | LOW |

**Rule:** Test the user flows that lose you money if broken. Skip everything else.

## Error Handling

```typescript
// MVP-appropriate error handling
try {
  const result = await createOrder(data);
  return { success: true, data: result };
} catch (error) {
  console.error("Order creation failed:", error);
  return { success: false, error: "Failed to create order" };
}
```

No custom error hierarchies. No error codes. No RFC 9457. Log it, return a message, move on.

## Deployment

- **Platform:** Vercel (frontend-heavy) or Railway (backend-heavy)
- **CI/CD:** GitHub Actions — lint + test + deploy (3 steps max)
- **Environments:** Production + Preview (Vercel auto). No staging.
- **Monitoring:** Error tracking (Sentry free tier) + uptime (Better Stack free)

## When to Upgrade to Tier 4

Upgrade when you have evidence, not speculation:

| Signal | Action |
|--------|--------|
| Response times > 500ms consistently | Add caching layer |
| Database CPU > 60% sustained | Add read replica or optimize queries |
| Team > 3 developers on same codebase | Extract module boundaries |
| Deployment frequency > 5x/day | Add staging environment |
| Revenue > $10K MRR | Invest in monitoring + reliability |
