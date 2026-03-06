---
title: Maintain changelogs in Keep a Changelog format with semantic versioning
impact: MEDIUM
impactDescription: "Without curated changelogs, users cannot assess upgrade risk or find breaking changes"
tags: [changelog, release-notes, semver, keep-a-changelog]
---

## Changelog Format

Changelogs are for humans, not machines. They must be curated, categorized, and linked to versions.

**Incorrect -- dumping git log as a changelog:**
```markdown
# Changes

- fix stuff
- update deps
- merge branch 'feature/auth'
- wip
- fix tests
- Merge pull request #42
- another fix
- bump version
```

**Correct -- curated Keep a Changelog format:**
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- OAuth 2.0 PKCE flow for single-page applications (#156)

## [2.1.0] - 2026-03-01

### Added
- Rate limiting middleware with configurable per-route limits (#148)
- Health check endpoint at `/healthz` with dependency status (#152)

### Changed
- Upgrade PostgreSQL driver from v8 to v9 for connection pool improvements (#150)

### Fixed
- Connection leak when database queries timeout under load (#147)
- Incorrect pagination count when filters applied (#149)

## [2.0.0] - 2026-02-15

### Changed
- **BREAKING:** Authentication tokens now use RS256 instead of HS256 (#140)
- **BREAKING:** Rename `/api/users` to `/api/v2/accounts` (#141)

### Removed
- **BREAKING:** Drop support for Node.js 18 (#139)

### Security
- Patch CVE-2026-1234 in XML parser dependency (#143)

[Unreleased]: https://github.com/org/repo/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/org/repo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/org/repo/releases/tag/v2.0.0
```

**Key rules:**
- Use exactly these six section headings: Added, Changed, Deprecated, Removed, Fixed, Security
- Prefix breaking changes with `**BREAKING:**` in the entry text
- Link each version header to a diff URL (compare previous tag to current)
- Include issue/PR numbers as `(#NNN)` for traceability
- `[Unreleased]` section at top collects changes for the next release
- Write entries from the user's perspective, not the developer's
- One entry per user-visible change -- combine related commits into a single entry
- Newest version at top, oldest at bottom
- Never auto-generate from git log -- curate deliberately
