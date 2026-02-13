---
title: Performance Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Core Web Vitals (cwv) — CRITICAL — 3 rules

Google's Core Web Vitals with 2026 stricter thresholds.

- `cwv-lcp.md` — LCP optimization: preload hero, SSR, fetchpriority
- `cwv-inp.md` — INP optimization: scheduler.yield, useTransition, requestIdleCallback
- `cwv-cls.md` — CLS prevention: explicit dimensions, aspect-ratio, font-display

## 2. Render Optimization (render) — HIGH — 3 rules

React render performance patterns for React 19+.

- `render-compiler.md` — React Compiler auto-memoization and verification
- `render-memo.md` — Manual memoization escape hatches and state colocation
- `render-virtual.md` — TanStack Virtual for large list virtualization

## 3. Lazy Loading (loading) — HIGH — 3 rules

Code splitting and lazy loading with React.lazy and Suspense.

- `loading-lazy.md` — React.lazy + Suspense patterns with error boundaries
- `loading-splitting.md` — Route-based code splitting with React Router 7.x
- `loading-preload.md` — Prefetch on hover, modulepreload hints, intersection observer

## 4. Image Optimization (images) — HIGH — 3 rules

Production image optimization for modern web applications.

- `images-nextjs.md` — Next.js Image component with priority and blur
- `images-formats.md` — AVIF/WebP format selection and quality settings
- `images-responsive.md` — Responsive sizes, art direction, CDN loaders

## 5. Profiling & Backend (profiling) — MEDIUM — 3 rules

Profiling tools and backend optimization patterns.

- `profiling-react.md` — React DevTools Profiler flamegraph and render analysis
- `profiling-backend.md` — Python profiling with py-spy, cProfile, memory_profiler
- `profiling-bundle.md` — Bundle analysis, tree shaking, performance budgets

## 6. LLM Inference (inference) — MEDIUM — 3 rules

High-performance LLM inference with vLLM, quantization, and speculative decoding.

- `inference-vllm.md` — vLLM 0.14.x deployment with PagedAttention and batching
- `inference-quantization.md` — AWQ, GPTQ, FP8, INT8 method selection
- `inference-speculative.md` — N-gram and draft model speculative decoding
