# Route Map

Map changed files to testable URLs. The route map is the bridge between "what files changed" and "what pages to test."

## Config-Based Route Map

The primary source is `.expect/config.yaml`:

```yaml
base_url: http://localhost:3000
route_map:
  # Component → pages that use it
  "src/components/Header.tsx": ["/", "/about", "/pricing", "/dashboard"]
  "src/components/auth/**": ["/login", "/signup", "/forgot-password"]

  # Page directory → URL pattern
  "src/app/dashboard/**": ["/dashboard"]
  "src/app/settings/**": ["/settings", "/settings/profile", "/settings/billing"]

  # API routes → pages that call them
  "src/app/api/auth/**": ["/login", "/signup"]
```

## Framework Inference (No Config)

When `.expect/config.yaml` doesn't exist, infer from the framework:

### Next.js App Router
```
src/app/page.tsx          → /
src/app/about/page.tsx    → /about
src/app/[slug]/page.tsx   → /{slug} (use a test slug)
src/app/api/auth/route.ts → /login (infer from API name)
```

### Next.js Pages Router
```
pages/index.tsx           → /
pages/about.tsx           → /about
pages/[id].tsx            → /{id}
```

### Generic SPA
```
src/routes/*.tsx           → /{filename}
src/views/*.vue            → /{filename}
```

## Route Resolution Priority

1. `.expect/config.yaml` explicit mapping (highest priority)
2. Framework-specific inference (Next.js, Remix, SvelteKit)
3. Grep for `<Link href=` or `router.push` patterns
4. Fall back to `base_url` root only

## Dynamic Routes

For dynamic routes (`[slug]`, `[id]`), use test values from:
1. `.expect/config.yaml` `test_params` section
2. First entry from a seed/fixture file
3. Default: `test-1`, `1`, `example`
