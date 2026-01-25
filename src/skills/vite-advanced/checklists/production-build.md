# Vite Production Build Checklist

Pre-deployment build verification.

## Configuration

- [ ] `build.target` set appropriately for audience
- [ ] `build.sourcemap` disabled or set to `'hidden'`
- [ ] `build.minify` enabled (esbuild or terser)
- [ ] Environment variables properly defined

## Bundle Optimization

- [ ] Run bundle analyzer: `npx vite-bundle-visualizer`
- [ ] No unexpected large chunks (> 500kb)
- [ ] Vendor chunks split appropriately
- [ ] No duplicate dependencies
- [ ] Tree shaking working (check for dead code)

## Chunk Strategy

```typescript
// Recommended manual chunks
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'router': ['react-router-dom'],
  'ui': ['@radix-ui/*'],
}
```

- [ ] React/framework in separate vendor chunk
- [ ] Route-based code splitting enabled
- [ ] Large libraries in separate chunks

## Assets

- [ ] Images optimized (WebP, AVIF)
- [ ] `assetsInlineLimit` set appropriately (default 4kb)
- [ ] Static assets in `public/` folder
- [ ] Asset filenames include hash for caching

## CSS

- [ ] CSS minified
- [ ] CSS code split by entry point (if needed)
- [ ] No unused CSS (PurgeCSS or similar)
- [ ] PostCSS processing complete

## Environment Variables

- [ ] `.env.production` exists with production values
- [ ] No secrets in client-side env vars
- [ ] `VITE_*` prefix used for client vars
- [ ] Build-time vars validated

## TypeScript

- [ ] `tsc --noEmit` passes
- [ ] No type errors in build
- [ ] Source maps working if enabled

## SSR (If Applicable)

- [ ] Server entry point builds correctly
- [ ] External dependencies configured
- [ ] Client manifest generated
- [ ] Hydration working

## Testing

- [ ] Build completes without errors
- [ ] Preview mode works: `vite preview`
- [ ] All routes accessible
- [ ] No console errors in production build
- [ ] Performance metrics acceptable

## Output Verification

```bash
# Check build output
ls -la dist/

# Check chunk sizes
du -sh dist/assets/*

# Preview locally
vite preview

# Test production server
NODE_ENV=production node server.js
```

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Initial JS | < 200kb gzipped | ___ |
| Main chunk | < 150kb | ___ |
| Vendor chunk | < 100kb | ___ |
| CSS | < 50kb | ___ |
| LCP | < 2.5s | ___ |
| TTI | < 3.5s | ___ |

## Pre-Deploy Commands

```bash
# Full build
npm run build

# Type check
npm run typecheck

# Preview
npm run preview

# Analyze bundle
npx vite-bundle-visualizer
```

## Common Issues

### Large Bundle
- Check for duplicate dependencies
- Ensure tree shaking is working
- Split vendor chunks
- Use dynamic imports

### Build Failures
- Clear `.vite` cache: `rm -rf node_modules/.vite`
- Check TypeScript errors
- Verify all imports resolve

### Missing Assets
- Check `public/` folder structure
- Verify asset paths in code
- Check `base` config if using subpath

## Sign-Off

- [ ] Build size within budget
- [ ] Preview works correctly
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Ready for deployment
