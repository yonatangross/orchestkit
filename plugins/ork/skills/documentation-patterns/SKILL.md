---
name: documentation-patterns
license: MIT
compatibility: "Claude Code 2.1.76+."
description: Technical documentation patterns for READMEs, ADRs, API docs (OpenAPI 3.1), changelogs, and writing style guides. Use when creating project documentation, writing architecture decisions, documenting APIs, or maintaining changelogs.
tags: [documentation, readme, adr, api-docs, openapi, changelog, writing-style, technical-writing]
version: 1.0.0
author: OrchestKit
user-invocable: false
disable-model-invocation: true
context: inherit
complexity: low
persuasion-type: reference
effort: low
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Documentation Patterns

Templates and opinionated structures for technical documentation -- READMEs, Architecture Decision Records, OpenAPI specs, changelogs, and writing style. Each category has individual rule files in `rules/` loaded on-demand.

## Quick Reference

| Category | Rule | Impact | When to Use |
|----------|------|--------|-------------|
| [README](#readme) | 1 | HIGH | Starting a project, onboarding contributors |
| [ADR](#architecture-decision-records) | 1 | HIGH | Recording architecture decisions |
| [API Docs](#api-documentation) | 1 | HIGH | Documenting REST APIs with OpenAPI 3.1 |
| [Changelog](#changelog) | 1 | MEDIUM | Maintaining release history |
| [Writing Style](#writing-style) | 1 | MEDIUM | Any technical writing task |

**Total: 5 rules across 5 categories**

## Quick Start

```markdown
## README Skeleton
# Project Name
Brief description -> Quick Start -> Installation -> Usage -> API -> Config -> Contributing -> License

## ADR Format
# ADR-001: Title
Status -> Context -> Decision -> Consequences (positive/negative) -> References

## OpenAPI Minimum
openapi: 3.1.0 with info, paths, components/schemas, error responses

## Changelog Entry
## [1.2.0] - 2026-03-05
### Added / Changed / Deprecated / Removed / Fixed / Security

## Writing Rule of Thumb
Active voice, present tense, second person, one idea per sentence
```

## README

Complete README template with all essential sections for open-source and internal projects.

- **`docs-readme-structure`** -- Project name, quick start, installation, usage, API reference, configuration, contributing, license

## Architecture Decision Records

Structured format for capturing architectural decisions with context and consequences.

- **`docs-adr-template`** -- Status, context, decision, consequences (positive/negative), references

## API Documentation

OpenAPI 3.1 specification patterns for consistent, machine-readable API docs.

- **`docs-api-openapi`** -- Path structure, operation definitions, schema components, error responses (RFC 9457)

## Changelog

Keep a Changelog format for curated, human-readable release history.

- **`docs-changelog-format`** -- Added, Changed, Deprecated, Removed, Fixed, Security sections with semver

## Writing Style

Technical writing conventions for clear, scannable documentation.

- **`docs-writing-style`** -- Active voice, present tense, concise sentences, API doc checklist

## Related Skills

- `ork:api-design` -- API design patterns (complements OpenAPI documentation)
- `ork:architecture-decision-record` -- ADR workflow and lifecycle
- `ork:release-management` -- Release process including changelog updates

**Version:** 1.0.0 (March 2026)
