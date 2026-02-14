# Open Source Guide (Tier 6)

Guidance for open-source libraries, frameworks, and tools.

## Target Metrics

| Metric | Target | Red Flag |
|--------|--------|----------|
| Public API surface | Minimal | Exposing internals |
| LOC ratio | 1.2-1.8x | > 2.5x (over-abstracted) |
| Test coverage (public API) | 95%+ | < 80% |
| Test coverage (internals) | 60%+ | < 40% |
| Dependencies | Minimal | > 10 runtime deps |
| Breaking changes per major | < 5 | > 15 |

## Architecture Principles

### 1. Minimal API Surface

Expose the minimum necessary. Everything public becomes a contract.

```typescript
// Good: Small, focused API
export { createClient } from "./client";
export type { ClientOptions, Client } from "./types";

// Bad: Leaking internals
export { createClient, _parseResponse, _buildUrl, _retryWithBackoff } from "./client";
```

### 2. Zero or Minimal Dependencies

Every dependency is a liability for consumers:
- Security vulnerabilities propagate
- Version conflicts with consumer's dependencies
- Bundle size increases
- Maintenance burden when deps are abandoned

**Prefer:** Vendoring small utilities over adding dependencies.

### 3. Backwards Compatibility

- Semantic versioning is non-negotiable
- Deprecate before removing (minimum 1 minor version)
- Migration guides for every breaking change
- Codemods when feasible (like Next.js does)

## Testing Strategy

| Type | Focus |
|------|-------|
| Unit tests | Every public API method, every edge case |
| Integration | Common usage patterns from README examples |
| Compatibility | Test against multiple Node/Python/runtime versions |
| Type tests | Verify TypeScript types work correctly (tsd, expect-type) |
| Snapshot | API surface snapshot to catch accidental breaks |
| Performance | Benchmark critical paths, regression testing |

### Test What Matters

```typescript
// Test public API behavior, not implementation details
test("createClient returns working client", () => {
  const client = createClient({ apiKey: "test" });
  expect(client.query).toBeDefined();
  expect(typeof client.query).toBe("function");
});

// Test edge cases consumers will hit
test("createClient throws on missing apiKey", () => {
  expect(() => createClient({})).toThrow("apiKey is required");
});
```

## Documentation

| Document | Purpose | Priority |
|----------|---------|----------|
| README.md | Quick start, installation, basic usage | CRITICAL |
| API reference | Every public method with examples | HIGH |
| CONTRIBUTING.md | How to contribute, dev setup | HIGH |
| CHANGELOG.md | Every version's changes | HIGH |
| Migration guide | Upgrade path between majors | HIGH (per major) |
| Architecture doc | Internal design for contributors | MEDIUM |

## What Makes Open Source Different

| Concern | Product Code | Open Source |
|---------|-------------|-------------|
| API design | Internal, change freely | Public contract, break carefully |
| Dependencies | Add what's useful | Minimize ruthlessly |
| Testing | Test business flows | Test every public API edge case |
| Docs | Internal wiki | Public, polished, with examples |
| Error messages | Log and fix | Descriptive — user can't see your code |
| Types | Nice to have | Essential — API discoverability |
| Bundle size | Less critical | Critical for frontend consumers |
| Node versions | Pick one | Support multiple (LTS at minimum) |

## Common Mistakes

| Mistake | Impact |
|---------|--------|
| Exposing too many internals as public API | Can never remove them |
| Heavy runtime dependencies | Conflicts + bloat for consumers |
| Not testing edge cases | Users find bugs, lose trust |
| Poor error messages | Users can't self-diagnose |
| No migration guide between versions | Users stay on old versions |
| Monolithic package | Users import everything for one feature |

## Package Structure Decisions

| Decision | Small Library | Framework |
|----------|--------------|-----------|
| Single package | Yes | No — use monorepo |
| Tree-shakeable | Essential | Essential |
| ESM + CJS | Both via dual exports | Both via dual exports |
| Subpath exports | If > 3 features | Yes — `pkg/feature` |
| Plugin system | No | Yes — extensibility |
