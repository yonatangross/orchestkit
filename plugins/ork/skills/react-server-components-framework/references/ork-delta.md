# ork delta: react-server-components-framework

House rules and scars only. Vendor tutorials for every topic this skill wraps live
in first-party sources; see "Upstream coverage (do not restate)" in SKILL.md.
Each entry below exists because OrchestKit shipped a wrong or house-specific
version of it first.

## Pass a cacheLife profile as the second argument to revalidateTag
Why: PR #2143 (2026-05-31 library-currency audit, next-react cluster) caught this skill teaching the fabricated one-argument form. In Next.js 16 the real signature is `revalidateTag(tag, profile)` (for example `'max'` or `{ expire: 3600 }`); the one-argument call is deprecated and a TypeScript error, there is no array overload (loop one call per tag), and read-your-writes invalidation uses `updateTag(tag)` instead.
Upstream: skill next-cache-components / vercel:next-cache-components (marketplace)

## Import proxy.ts types from next/server, never from a next/proxy module
Why: PR #2143 removed a fully fabricated `next/proxy` API (ProxyRequest, ProxyResponse, `redirect()`, `next()` helpers) that this skill had documented. The real Next.js 16 change is only: rename `middleware.ts` to `proxy.ts`, export a named `proxy` function, keep `NextRequest`/`NextResponse` from `next/server`, same function body; and `proxy.ts` runs on the Node.js runtime only (no Edge).
Upstream: skill next-upgrade / vercel:next-upgrade (marketplace)

## Write 'use cache' as a directive, not a cache() wrapper from next/cache
Why: PR #2143 removed a fabricated `import { cache } from 'next/cache'` wrapper this skill had documented. The real API is the `'use cache'` directive (plus `'use cache: remote'` and `'use cache: private'` in 16.2) with the `cacheLife()` / `cacheTag()` helpers, whose `unstable_` prefix was dropped in 16.2; the `experimental_ppr` flag is replaced by `cacheComponents: true` in next.config.ts.
Upstream: skill next-cache-components / vercel:next-cache-components (marketplace)

## Format Server Action Zod errors with z.treeifyError, not .flatten
Why: PR #2143 (frontend-libs cluster, Zod 4 currency fix): `.flatten()` is deprecated in Zod 4 and the replacement changes the payload shape, per-field messages move to `tree.properties[field].errors`, which silently breaks clients still reading `fieldErrors`.
Upstream: Zod 4 error formatting docs (https://zod.dev)

## Declare React components as function declarations, never React.FC or forwardRef
Why: House standard adopted with the React 19 floor bump (distilled 2026-07-31 from the retired references/react-19-patterns.md; no traced incident). React 19 drops React.FC's implicit `children` and makes `ref` a regular prop, so the house standard is function declarations with explicit `children` / `ref` props, an explicit `React.ReactNode` return type, and an ESLint ban-types rule that blocks `React.FC` and `React.FunctionComponent`.
Upstream: react.dev React 19 upgrade guide (context7: /vercel/next.js + react.dev query-docs)

## Cache the promise before handing it to the use() hook
Why: Standard React 19 trap kept as a house rule (distilled from the retired react-19-patterns.md; no traced incident): a promise created during render makes `use()` re-suspend on every pass, an infinite loop. House pattern is a keyed promise cache (`cachePromise(key, fetcher)`) that deletes rejected entries so retry works, with explicit invalidation on mutation and a full clear on logout.
Upstream: react.dev use() reference (context7 query-docs)

## Use use() only for one-shot reads, TanStack Query for everything else
Why: House rule of thumb (adopted with the 2026-07-31 wrap-plus-delta campaign): `use()` covers read-only display of a single fetch; mutations, refetching, background refresh, optimistic updates, and infinite scroll stay on TanStack Query. Do not rebuild query-cache management around `use()`.
Upstream: TanStack Query docs (https://tanstack.com/query/latest) and react.dev use() reference
