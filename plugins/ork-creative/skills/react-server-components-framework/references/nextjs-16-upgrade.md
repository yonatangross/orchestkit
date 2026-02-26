# Next.js 16 Upgrade Guide

This reference covers breaking changes and migration steps when upgrading from Next.js 15 to Next.js 16.

## Version Requirements

| Dependency | Minimum Version |
|------------|-----------------|
| Node.js | 20.9.0+ |
| TypeScript | 5.1.0+ |
| React | 19.0.0+ |
| React DOM | 19.0.0+ |

```bash
# Check your versions
node --version   # Must be v20.9.0 or higher
npx tsc --version # Must be 5.1.0 or higher
```

---

## Breaking Changes

### 1. Async Params and SearchParams

Dynamic route parameters and search parameters are now Promises that must be awaited.

**Before (Next.js 15)**

```tsx
// app/posts/[slug]/page.tsx
export default function PostPage({ params, searchParams }) {
  const { slug } = params
  const { page } = searchParams
  return <Post slug={slug} page={page} />
}
```

**After (Next.js 16)**

```tsx
// app/posts/[slug]/page.tsx
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page } = await searchParams
  return <Post slug={slug} page={page} />
}
```

**Layout components**

```tsx
// app/posts/[slug]/layout.tsx
export default async function PostLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>
  children: React.ReactNode
}) {
  const { slug } = await params
  return (
    <div>
      <Sidebar slug={slug} />
      {children}
    </div>
  )
}
```

**generateMetadata**

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title }
}
```

---

### 2. Async Request APIs

The `cookies()`, `headers()`, and `draftMode()` functions are now async.

**Before (Next.js 15)**

```tsx
import { cookies, headers, draftMode } from 'next/headers'

export default function Page() {
  const cookieStore = cookies()
  const headersList = headers()
  const { isEnabled } = draftMode()

  const token = cookieStore.get('token')
  const userAgent = headersList.get('user-agent')

  return <div>...</div>
}
```

**After (Next.js 16)**

```tsx
import { cookies, headers, draftMode } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const { isEnabled } = await draftMode()

  const token = cookieStore.get('token')
  const userAgent = headersList.get('user-agent')

  return <div>...</div>
}
```

**Server Actions**

```tsx
'use server'

import { cookies } from 'next/headers'

export async function setTheme(theme: string) {
  const cookieStore = await cookies()
  cookieStore.set('theme', theme)
}
```

---

### 3. Middleware Migration (middleware.ts to proxy.ts)

The middleware file has been renamed and restructured for improved clarity.

**Before (Next.js 15)**

```tsx
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

**After (Next.js 16)**

```tsx
// proxy.ts
import { type ProxyRequest, type ProxyResponse, redirect, next } from 'next/proxy'

export default function proxy(request: ProxyRequest): ProxyResponse {
  const token = request.cookies.get('token')

  if (!token && request.pathname.startsWith('/dashboard')) {
    return redirect('/login')
  }

  return next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

**Key changes:**
- File renamed from `middleware.ts` to `proxy.ts`
- Import from `next/proxy` instead of `next/server`
- Use `redirect()` and `next()` helpers instead of `NextResponse` methods
- `request.nextUrl.pathname` simplified to `request.pathname`

---

### 4. PPR Migration (experimental_ppr to Cache Components)

Partial Prerendering experimental flag has been replaced with Cache Components.

**Before (Next.js 15)**

```tsx
// app/products/page.tsx
export const experimental_ppr = true

export default async function ProductsPage() {
  return (
    <div>
      <StaticHeader />
      <Suspense fallback={<ProductsSkeleton />}>
        <DynamicProducts />
      </Suspense>
    </div>
  )
}
```

**After (Next.js 16)**

```tsx
// app/products/page.tsx
import { cache } from 'next/cache'

// Wrap static content in cache()
const CachedHeader = cache(async () => {
  return <StaticHeader />
})

export default async function ProductsPage() {
  return (
    <div>
      <CachedHeader />
      <Suspense fallback={<ProductsSkeleton />}>
        <DynamicProducts />
      </Suspense>
    </div>
  )
}
```

**Cache Components with options**

```tsx
import { cache } from 'next/cache'

// Cache with revalidation
const CachedSidebar = cache(
  async () => {
    const categories = await getCategories()
    return <Sidebar categories={categories} />
  },
  { revalidate: 3600 } // 1 hour
)

// Cache with tags
const CachedProductList = cache(
  async () => {
    const products = await getProducts()
    return <ProductList products={products} />
  },
  { tags: ['products'] }
)
```

---

### 5. AMP Support Removed

AMP (Accelerated Mobile Pages) support has been completely removed.

**Migration steps:**

1. Remove `amp` exports from pages
2. Remove AMP-specific components
3. Use responsive design and modern performance techniques instead

**Before (Next.js 15)**

```tsx
// pages/article.tsx
export const config = { amp: true }

export default function Article() {
  return (
    <amp-img src="/hero.jpg" width="800" height="400" />
  )
}
```

**After (Next.js 16)**

```tsx
// app/article/page.tsx
import Image from 'next/image'

export default function Article() {
  return (
    <Image
      src="/hero.jpg"
      width={800}
      height={400}
      priority
      alt="Hero image"
    />
  )
}
```

---

### 6. ESLint Configuration (next lint removed)

The `next lint` command has been removed. Use ESLint directly.

**Before (Next.js 15)**

```json
{
  "scripts": {
    "lint": "next lint"
  }
}
```

**After (Next.js 16)**

```bash
# Install ESLint and Next.js config
npm install eslint eslint-config-next --save-dev
```

```json
{
  "scripts": {
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx"
  }
}
```

**eslint.config.mjs (Flat Config)**

```js
// eslint.config.mjs
import nextPlugin from '@next/eslint-plugin-next'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'

export default [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
]
```

---

### 7. Parallel Routes Require default.js

Parallel routes now require a `default.js` (or `default.tsx`) file.

**Before (Next.js 15)**

```
app/
  @modal/
    login/
      page.tsx
  layout.tsx
  page.tsx
```

**After (Next.js 16)**

```
app/
  @modal/
    default.tsx    # Required!
    login/
      page.tsx
  layout.tsx
  page.tsx
```

**default.tsx content**

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null
}
```

The `default.tsx` file renders when the parallel route slot has no active match. Without it, Next.js 16 will throw a build error.

---

## Turbopack as Default Bundler

Next.js 16 uses Turbopack as the default bundler for both development and production.

### Opting Out to Webpack

If you encounter Turbopack compatibility issues:

```bash
# Development
next dev --webpack

# Production build
next build --webpack
```

**package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:webpack": "next dev --webpack",
    "build": "next build",
    "build:webpack": "next build --webpack"
  }
}
```

### Sass Tilde Prefix Removal

Turbopack does not support the `~` prefix for importing from `node_modules` in Sass files.

**Before**

```scss
// styles/globals.scss
@import '~bootstrap/scss/bootstrap';
@import '~@fontsource/inter/index.css';
```

**After**

```scss
// styles/globals.scss
@import 'bootstrap/scss/bootstrap';
@import '@fontsource/inter/index.css';
```

**Find and replace all occurrences**

```bash
# Find files with tilde imports
grep -r "~" --include="*.scss" --include="*.sass" .

# Common patterns to replace:
# ~package-name  ->  package-name
# ~@scope/package  ->  @scope/package
```

---

## New Caching APIs

### updateTag()

Granular tag updates without full revalidation:

```tsx
'use server'

import { updateTag } from 'next/cache'

export async function updateProduct(id: string, data: ProductData) {
  await db.product.update({ where: { id }, data })

  // Update only this product's cache, not all products
  updateTag(`product-${id}`)
}
```

### refresh()

Force refresh the current route's data:

```tsx
'use client'

import { refresh } from 'next/navigation'

export function RefreshButton() {
  return (
    <button onClick={() => refresh()}>
      Refresh Data
    </button>
  )
}
```

### New revalidateTag() Signature

The `revalidateTag()` function now accepts options:

**Before (Next.js 15)**

```tsx
import { revalidateTag } from 'next/cache'

revalidateTag('products')
```

**After (Next.js 16)**

```tsx
import { revalidateTag } from 'next/cache'

// Simple revalidation (same as before)
revalidateTag('products')

// With options
revalidateTag('products', {
  type: 'layout', // Revalidate layouts using this tag
})

revalidateTag('products', {
  type: 'page', // Revalidate only pages (default)
})

// Revalidate multiple tags
revalidateTag(['products', 'categories'])
```

---

## Migration Checklist

### Pre-Migration

- [ ] Verify Node.js version is 20.9.0+
- [ ] Verify TypeScript version is 5.1.0+
- [ ] Review breaking changes list
- [ ] Backup project or create migration branch
- [ ] Run existing tests to establish baseline

### Core Changes

- [ ] Update `package.json` dependencies
- [ ] Add `await` to all `params` and `searchParams` access
- [ ] Add `await` to `cookies()`, `headers()`, `draftMode()` calls
- [ ] Rename `middleware.ts` to `proxy.ts` and update imports
- [ ] Replace `experimental_ppr` with Cache Components
- [ ] Add `default.tsx` to all parallel route slots
- [ ] Update ESLint configuration (remove `next lint`)

### Sass/Turbopack

- [ ] Remove `~` prefix from all Sass imports
- [ ] Test build with Turbopack (default)
- [ ] If issues, document and use `--webpack` flag temporarily

### AMP (if applicable)

- [ ] Remove `amp` configuration from pages
- [ ] Replace AMP components with standard React/Next.js components
- [ ] Update performance monitoring for non-AMP pages

### Testing

- [ ] Run full test suite
- [ ] Test all dynamic routes with async params
- [ ] Verify middleware (proxy) behavior
- [ ] Check caching behavior with new APIs
- [ ] Performance test with Turbopack vs Webpack

### Post-Migration

- [ ] Update CI/CD scripts for new ESLint config
- [ ] Update documentation
- [ ] Monitor production for issues
- [ ] Remove temporary Webpack fallbacks once stable

---

## Automated Migration

Next.js provides a codemod to automate some migrations:

```bash
# Run the Next.js 16 upgrade codemod
npx @next/codemod@latest upgrade

# Run specific codemods
npx @next/codemod@latest async-request-apis .
npx @next/codemod@latest async-dynamic-apis .
```

**Note:** Review all automated changes manually. The codemod handles most cases but may miss edge cases in complex codebases.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `params is not defined` | Missing await | Add `await params` |
| `cookies is not a function` | Sync usage | Add `await cookies()` |
| `Cannot find module 'next/server'` in middleware | Old imports | Rename to `proxy.ts`, use `next/proxy` |
| `experimental_ppr is not a valid export` | Removed feature | Use Cache Components |
| `Missing default.js in parallel route` | New requirement | Add `default.tsx` returning `null` |
| `Cannot resolve '~package'` in Sass | Turbopack | Remove `~` prefix |
| `next lint command not found` | Removed command | Use `eslint` directly |

---

## Resources

- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Turbopack Documentation](https://turbo.build/pack/docs)
- [Cache Components RFC](https://github.com/vercel/next.js/discussions/cache-components)
- [ESLint Flat Config Migration](https://eslint.org/docs/latest/use/configure/migration-guide)
