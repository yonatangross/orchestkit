---
title: Design to Code Rule Categories
version: 2.0.0
---

# Rule Categories

## 1. Catalog Registration (catalog): MEDIUM, 1 rule

How to register adapted components as json-render catalog entries for multi-surface reuse.

- `catalog-registration.md`: Zod schema generation from props, defineCatalog integration, multi-surface enablement

## 2. Component Discovery (discovery): HIGH, 1 rule

Storybook mode: look at what the project already has before generating anything.

- `component-discovery.md`: check existing Storybook components before generating new ones

## 3. Visual Verification (preview): HIGH, 1 rule

Storybook mode: show the result instead of describing it.

- `story-preview-verification.md`: embed story previews for visual confirmation

## 4. Testing (testing): CRITICAL, 1 rule

Storybook mode: prove the component before handing it over.

- `mcp-test-runner.md`: run story tests + a11y audits via MCP after generation
