# Payload vs Sanity — CMS Comparison

Detailed comparison and decision matrix for choosing between Payload CMS 3.0, Sanity, Strapi, and WordPress.

## Feature Comparison

| Feature | Payload 3.0 | Sanity v3 | Strapi v5 | WordPress |
|---------|-------------|-----------|-----------|-----------|
| **Language** | TypeScript | TypeScript + GROQ | JavaScript/TS | PHP |
| **Framework** | Built on Next.js | React (studio) | Koa.js | Monolithic |
| **Hosting** | Self-hosted | Hosted API + self-hosted studio | Self-hosted | Self/hosted |
| **Database** | MongoDB or Postgres | Hosted (proprietary) | SQLite/Postgres/MySQL | MySQL |
| **Auth** | Built-in (JWT + cookies) | Hosted or custom | Built-in (JWT) | Built-in (sessions) |
| **API** | REST + GraphQL auto-generated | GROQ + GraphQL | REST + GraphQL | REST + GraphQL (plugin) |
| **Rich Text** | Lexical (built-in) | Portable Text | CKEditor/custom | Gutenberg |
| **Admin UI** | React + Next.js | React (Sanity Studio) | React | PHP + React (Gutenberg) |
| **Type Safety** | Config IS the schema | Schema + codegen | Schema + codegen | None natively |
| **Plugins** | npm packages | npm packages | npm marketplace | Plugin ecosystem (massive) |
| **License** | MIT (open source) | Freemium (hosted) | MIT with EE features | GPLv2 |
| **Live Preview** | Built-in | Built-in | Via plugin | Theme preview |
| **Versioning** | Built-in per collection | Built-in | Via plugin | Built-in (revisions) |

## Cost Comparison

| Tier | Payload | Sanity | Strapi |
|------|---------|--------|--------|
| **Free** | Unlimited (self-host) | 100K API requests/mo, 3 users | Unlimited (self-host) |
| **Team** | Payload Cloud ($25/mo) | $99/mo (500K requests) | $29/mo (gold support) |
| **Enterprise** | Custom | Custom | Custom |

Payload is fully open source — cost is infrastructure only. Sanity's cost scales with API usage.

## Decision Matrix

### Choose Payload When:
- Building a **Next.js application** — Payload runs inside your Next.js app
- You want **full ownership** of data and infrastructure
- Your team is **TypeScript-first** — config-as-code is natural
- You need **custom access control** beyond simple roles
- Self-hosting is acceptable or preferred
- You want **one deployment** (CMS + frontend in same app)

### Choose Sanity When:
- **Content editors** are primary users, not developers
- You need **real-time collaborative editing** (Google Docs-style)
- Your content is consumed by **multiple frontends** (web, mobile, IoT)
- You want a **hosted API** with no infrastructure management
- **GROQ** query language fits your content querying needs
- Editorial workflow and content scheduling are critical

### Choose Strapi When:
- You need a **quick admin panel** with minimal configuration
- Your team prefers a **GUI-first** content modeling approach
- You want a **marketplace** of pre-built plugins
- The project is a **prototype or MVP** that may change CMS later
- You need **multi-database support** (SQLite for dev, Postgres for prod)

### Choose WordPress When:
- **Non-technical editors** need to manage content independently
- You need the **largest plugin ecosystem** (100K+ plugins)
- SEO tooling (Yoast, RankMath) is a core requirement
- Budget for development is limited — large talent pool
- Content is primarily **blog/marketing pages**

## Migration Considerations

### From Sanity to Payload
1. Export content via GROQ: `*[_type == "post"]`
2. Map Portable Text to Lexical rich text format
3. Recreate schemas as Payload collection configs
4. Migrate assets from Sanity CDN to local/S3 storage
5. Rebuild GROQ queries as Payload `where` clauses

### From Strapi to Payload
1. Export via Strapi REST API
2. Map Strapi content types to Payload collections 1:1
3. Convert Strapi lifecycle hooks to Payload hooks
4. Migrate media from Strapi uploads to Payload upload collections
5. Replace Strapi custom controllers with Payload custom endpoints

### From WordPress to Payload
1. Export via WP REST API (`/wp-json/wp/v2/posts`)
2. Convert ACF/custom fields to Payload field configs
3. Map WordPress taxonomies to Payload relationship fields
4. Migrate media library to Payload upload collection
5. Convert WordPress template hierarchy to Next.js layouts

## Architecture Comparison

```
Payload 3.0:                    Sanity:
┌─────────────────────┐        ┌──────────────┐    ┌──────────────┐
│   Your Next.js App  │        │ Sanity Studio │    │  Your App    │
│  ┌───────────────┐  │        │  (React SPA)  │    │ (any framework)│
│  │ Payload CMS   │  │        └──────┬───────┘    └──────┬───────┘
│  │  (embedded)   │  │               │                    │
│  └───────┬───────┘  │               ▼                    ▼
│          │          │        ┌──────────────┐    ┌──────────────┐
│          ▼          │        │  Sanity API   │    │  Sanity API  │
│  ┌───────────────┐  │        │   (hosted)    │    │   (hosted)   │
│  │ MongoDB/PG    │  │        └──────────────┘    └──────────────┘
│  └───────────────┘  │
└─────────────────────┘        Single hosted API, multiple consumers
Single deployment, full control
```

## When NOT to Use a Headless CMS

- **Static content** that rarely changes — use Markdown + static site generator
- **Application data** (user profiles, orders, analytics) — use a database directly
- **Real-time data** (chat, live feeds) — use purpose-built real-time tools
- Content that only developers edit — YAML/JSON config files may suffice
