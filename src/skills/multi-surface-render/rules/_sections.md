---
title: Multi-Surface Render Rule Categories
version: 1.0.0
---

# Rule Categories

## 1. Target Selection (target) — HIGH — 1 rule

Decision criteria for selecting the right renderer target based on output format, platform constraints, and use case.

- `target-selection.md` — Use case mapping, output format constraints, package selection

## 2. React Renderer (react) — MEDIUM — 1 rule

Web rendering patterns using the `<Renderer>` component with progressive streaming and error boundaries.

- `react-renderer.md` — Renderer component, streaming, error boundaries, hydration

## 3. PDF & Email Renderer (pdf-email) — HIGH — 2 targets in 1 rule

Server-side rendering to PDF (renderToBuffer, renderToFile, renderToStream) and HTML email (renderToHtml).

- `pdf-email-renderer.md` — react-pdf output modes, react-email HTML generation, registry patterns

## 4. Video & Image Renderer (video-image) — MEDIUM — 2 targets in 1 rule

Remotion compositions for video and Satori-based image generation for OG images and social cards.

- `video-image-renderer.md` — JsonRenderComposition, renderToPng, renderToSvg, Satori constraints

## 5. Registry Mapping (registry) — HIGH — 1 rule

Creating platform-specific registries that map a shared catalog to surface-native component implementations.

- `registry-mapping.md` — Per-platform registries, type-safe mapping, shared catalog pattern
