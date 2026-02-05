# Edge Deployment Checklist

## Pre-Deployment Checks

### Code Quality

- [ ] **Bundle size is optimized** (< 1MB compressed for Workers, < 500KB for Edge Functions)
  - Run: `npx wrangler deploy --dry-run --outdir=./dist` (Cloudflare)
  - Run: `npm run build` and check `.next/static` size (Vercel)
  - Use: `npm run analyze` to identify large dependencies

- [ ] **No Node.js-specific APIs used**
  - No `fs`, `path`, `child_process`, `crypto` (Node version)
  - Only Web APIs: `fetch`, `Request`, `Response`, `Headers`, `crypto.subtle`
  - Check: Run through edge runtime validator

- [ ] **All dependencies are edge-compatible**
  - Verify each package works in V8 isolates
  - Test with local edge runtime (`wrangler dev` or `npm run dev`)
  - Replace incompatible packages (see runtime-differences.md)

- [ ] **Environment variables are properly configured**
  - Secrets stored securely (not in code)
  - Environment-specific configs separated (dev, staging, prod)
  - Cloudflare: Set via `wrangler secret put`
  - Vercel: Set in dashboard or `.env.production`

- [ ] **Error handling is comprehensive**
  - All async operations wrapped in try-catch
  - Graceful fallbacks for external API failures
  - Proper HTTP status codes returned
  - Error logging configured (but not blocking)

### Performance

- [ ] **Cold start time is acceptable** (< 50ms target)
  - Minimize top-level imports
  - Use dynamic imports for heavy dependencies
  - Profile with: `console.time('init')` in development

- [ ] **Response time is optimized** (< 100ms target)
  - Cache expensive computations
  - Use streaming for large responses
  - Implement stale-while-revalidate where appropriate

- [ ] **Rate limiting is implemented**
  - Protect against DDoS and abuse
  - Use KV/Durable Objects for distributed rate limiting
  - Return proper 429 status with Retry-After header

- [ ] **Caching strategy is defined**
  - Cache-Control headers set appropriately
  - Edge cache vs browser cache distinction clear
  - Cache invalidation strategy documented

### Security

- [ ] **Authentication is edge-optimized**
  - JWT verification uses Web Crypto API
  - Tokens validated without database calls
  - Refresh token mechanism in place

- [ ] **CORS is properly configured**
  - Allowed origins explicitly listed (not `*`)
  - Preflight requests handled correctly
  - Credentials mode configured appropriately

- [ ] **Security headers are set**
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Content-Security-Policy` configured
  - `Strict-Transport-Security` for HTTPS

- [ ] **Input validation is thorough**
  - Request body size limits enforced
  - Content-Type validation for POST/PUT
  - URL parameters sanitized
  - No code injection vulnerabilities

- [ ] **Secrets are never logged**
  - No API keys in console.log
  - Error messages don't leak sensitive data
  - Request/response logging sanitized

## Environment Setup

### Cloudflare Workers

- [ ] **wrangler.toml is configured**
  ```toml
  name = "my-worker"
  main = "src/index.ts"
  compatibility_date = "2025-01-01"

  [vars]
  ENVIRONMENT = "production"
  ```

- [ ] **KV namespaces are created**
  ```bash
  npx wrangler kv:namespace create MY_KV
  npx wrangler kv:namespace create MY_KV --preview
  ```

- [ ] **Durable Objects are registered** (if used)
  ```toml
  [[durable_objects.bindings]]
  name = "COUNTER"
  class_name = "Counter"
  ```

- [ ] **Routes are configured**
  ```toml
  routes = [
    { pattern = "example.com/*", zone_name = "example.com" }
  ]
  ```

- [ ] **Custom domains are set up**
  - DNS records point to Cloudflare
  - SSL/TLS certificates active
  - Route patterns match expected traffic

### Vercel Edge

- [ ] **Project is linked**
  ```bash
  npx vercel link
  ```

- [ ] **Environment variables are set**
  ```bash
  npx vercel env add API_KEY production
  ```

- [ ] **Edge Config is created** (if using feature flags)
  ```bash
  npx vercel edge-config create my-config
  ```

- [ ] **Middleware matcher is correct**
  ```typescript
  export const config = {
    matcher: ['/api/:path*', '/dashboard/:path*']
  }
  ```

- [ ] **Runtime is explicitly set**
  ```typescript
  export const runtime = 'edge'
  ```

### Deno Deploy

- [ ] **GitHub repository is connected**
  - Deployment triggers configured (main branch)
  - Build command specified
  - Entry point set correctly

- [ ] **Environment variables are added**
  - In Deno Deploy dashboard
  - Separate configs for preview/production

- [ ] **Regions are selected**
  - Primary region closest to users
  - Failover regions configured

## Testing

### Local Testing

- [ ] **Local development server runs without errors**
  - Cloudflare: `npx wrangler dev`
  - Vercel: `npm run dev`
  - Deno: `deno run --allow-net --allow-env main.ts`

- [ ] **All routes return expected responses**
  - Test with curl: `curl -X POST http://localhost:8787/api/test`
  - Test in browser: `http://localhost:3000/api/test`
  - Check response headers with dev tools

- [ ] **Error cases are handled gracefully**
  - Test 404, 401, 403, 429, 500 responses
  - Verify error messages are user-friendly
  - Check logs for proper error tracking

- [ ] **Performance is acceptable locally**
  - Response times < 100ms for simple requests
  - No memory leaks (test with sustained load)
  - CPU usage reasonable (< 30% spike)

### Integration Testing

- [ ] **External API integrations work**
  - Test with real API keys (staging environment)
  - Handle timeout scenarios
  - Verify retry logic

- [ ] **Database connections succeed** (if applicable)
  - Connection pooling configured
  - Query timeouts set appropriately
  - Fallback to cache on DB failure

- [ ] **Authentication flow is tested**
  - Valid tokens accepted
  - Invalid tokens rejected
  - Expired tokens refresh properly

- [ ] **Caching behavior is verified**
  - Cache hits return stale data appropriately
  - Cache misses fetch fresh data
  - Cache invalidation works

### Load Testing

- [ ] **Concurrent request handling**
  - Test with tools: `ab`, `wrk`, `autocannon`
  - Example: `ab -n 1000 -c 10 https://example.com/api/test`
  - Verify no dropped requests

- [ ] **Rate limiting is effective**
  - Exceed rate limit and verify 429 response
  - Wait for window reset and verify access restored

- [ ] **Edge locations respond consistently**
  - Test from multiple geographic regions
  - Use: `curl --resolve` or multi-region testing tools
  - Verify response times < 100ms globally

## Deployment

### Pre-Deployment

- [ ] **Code is reviewed and approved**
  - Peer review completed
  - Security review for sensitive changes
  - No console.log statements in production code

- [ ] **Tests pass in CI/CD**
  - Unit tests: 100% pass rate
  - Integration tests: All critical paths covered
  - No linting errors

- [ ] **Changelog is updated**
  - Document breaking changes
  - List new features
  - Note deprecations

### Deployment Process

- [ ] **Deploy to staging first**
  - Cloudflare: `npx wrangler deploy --env staging`
  - Vercel: `npx vercel --target preview`
  - Test staging thoroughly before production

- [ ] **Smoke test staging deployment**
  - Hit all critical endpoints
  - Verify authentication works
  - Check logs for errors

- [ ] **Deploy to production**
  - Cloudflare: `npx wrangler deploy`
  - Vercel: `npx vercel --prod`
  - Deno: Push to main branch (auto-deploys)

- [ ] **Verify deployment success**
  - Check deployment logs for errors
  - Verify version number updated
  - Test production URL responds

### Post-Deployment

- [ ] **Monitor initial traffic**
  - Watch error rates (should be < 0.1%)
  - Check response times (should be < 100ms p95)
  - Verify cache hit ratio (> 70% for cacheable content)

- [ ] **Test critical user flows**
  - Login/logout
  - API requests
  - Page loads

- [ ] **Check logs for unexpected errors**
  - Cloudflare: `npx wrangler tail`
  - Vercel: Check dashboard logs
  - Set up alerts for error spikes

- [ ] **Validate edge distribution**
  - Requests hitting multiple edge locations
  - No single region overwhelmed
  - Latency consistent globally

## Monitoring and Debugging

### Observability Setup

- [ ] **Logging is configured**
  - Structured logs (JSON format)
  - Log levels appropriate (ERROR, WARN, INFO)
  - No sensitive data in logs

- [ ] **Metrics are tracked**
  - Request count
  - Error rate
  - Response time (p50, p95, p99)
  - Cache hit ratio

- [ ] **Alerting is set up**
  - Error rate > 1% triggers alert
  - Response time p95 > 500ms triggers alert
  - Rate limit violations tracked

- [ ] **Dashboard is configured**
  - Cloudflare: Analytics tab
  - Vercel: Analytics dashboard
  - Custom: Grafana, Datadog, etc.

### Debugging Tools

- [ ] **Live logs are accessible**
  - Cloudflare: `npx wrangler tail`
  - Vercel: Dashboard → Functions → Logs
  - Real-time filtering works

- [ ] **Edge locations are identified**
  - Add `X-Edge-Location` header in responses
  - Track which regions serve traffic
  - Identify regional issues

- [ ] **Request tracing is enabled**
  - Unique request IDs in responses
  - Correlation IDs for multi-service requests
  - Trace logs across services

## Rollback Plan

- [ ] **Previous version is identified**
  - Cloudflare: `npx wrangler deployments list`
  - Vercel: Dashboard → Deployments
  - Git commit hash recorded

- [ ] **Rollback command is documented**
  - Cloudflare: `npx wrangler rollback --message "Revert bad deploy"`
  - Vercel: Dashboard → Deployments → Promote previous
  - Tested in staging environment

- [ ] **Rollback criteria are defined**
  - Error rate > 5%
  - Response time p95 > 1s
  - Critical feature broken

## Compliance and Documentation

- [ ] **Privacy policy updated** (if collecting user data)
- [ ] **Terms of service reflect edge processing**
- [ ] **GDPR compliance verified** (for EU users)
- [ ] **API documentation updated**
- [ ] **Runbook created** (deployment, rollback, debugging)
- [ ] **Team trained** on edge deployment process

## Platform-Specific Checks

### Cloudflare Workers Only

- [ ] **Subrequest limits considered** (50 on free, 1000 on paid)
- [ ] **CPU time within limits** (10ms free, 30s paid)
- [ ] **KV eventually consistent behavior handled** (60s propagation)
- [ ] **Durable Objects isolated per-object** (not global state)

### Vercel Edge Only

- [ ] **Function size within limits** (1MB compressed)
- [ ] **Execution time within limits** (25s Hobby, 30s Pro)
- [ ] **Edge Config read-only** (writes go through API)
- [ ] **Middleware doesn't block rendering** (fast execution)

### Deno Deploy Only

- [ ] **Import specifiers are full URLs** (not bare imports)
- [ ] **Dependencies are pinned** (versioned CDN URLs)
- [ ] **Standard library used** (deno.land/std@0.x.x)
- [ ] **Permissions are minimal** (only necessary --allow-* flags)
