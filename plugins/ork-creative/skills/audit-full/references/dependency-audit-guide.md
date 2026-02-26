# Dependency Audit Guide

License compliance, CVE checking, and version currency analysis.

## CVE Checking

### Automated Scanners

```bash
# JavaScript/TypeScript
npm audit --json
npx better-npm-audit audit

# Python
pip-audit --format=json
safety check --json

# Go
govulncheck ./...

# Rust
cargo audit
```

### Manual CVE Check

For dependencies without scanner coverage:
1. Check version in `package.json` / `pyproject.toml` / `go.mod`
2. Search [NVD](https://nvd.nist.gov/) or [OSV](https://osv.dev/) for package name
3. Compare installed version against affected version ranges
4. Classify by CVSS score

| CVSS Score | Severity | Action |
|-----------|----------|--------|
| 9.0-10.0 | CRITICAL | Update immediately |
| 7.0-8.9 | HIGH | Update within 1 week |
| 4.0-6.9 | MEDIUM | Update within 1 month |
| 0.1-3.9 | LOW | Track in backlog |

## License Compliance

### License Risk Tiers

| Tier | Licenses | Risk in Proprietary Code |
|------|----------|--------------------------|
| Permissive | MIT, BSD-2, BSD-3, ISC, Apache-2.0 | Safe |
| Weak copyleft | LGPL-2.1, LGPL-3.0, MPL-2.0 | Safe if dynamically linked |
| Strong copyleft | GPL-2.0, GPL-3.0, AGPL-3.0 | Requires source disclosure |
| Unknown | UNLICENSED, custom | Review manually |

### Detection Method

```bash
# JavaScript
npx license-checker --json --production

# Python
pip-licenses --format=json --with-urls

# Check for problematic licenses
npx license-checker --failOn "GPL-2.0;GPL-3.0;AGPL-3.0"
```

### What to Flag

- Any GPL/AGPL dependency in proprietary codebase → CRITICAL
- UNLICENSED dependencies → HIGH (legal risk)
- Dependencies with no license file → MEDIUM
- License changed between versions → LOW (track)

## Version Currency

### Currency Classification

| Status | Definition | Example |
|--------|-----------|---------|
| Current | Within 1 minor version of latest | react 19.1 when 19.2 is latest |
| Stale | 1+ major version behind | react 18.x when 19.x is latest |
| Outdated | 2+ major versions behind | react 17.x when 19.x is latest |
| EOL | No longer maintained | moment.js, request |

### High-Risk Outdated Patterns

| Pattern | Risk |
|---------|------|
| Framework 2+ majors behind | Missing security patches |
| Auth library outdated | Known vulnerabilities |
| TLS/crypto library outdated | Weak algorithms |
| ORM/DB driver outdated | SQL injection patches missing |

## Transitive Dependency Risk

### Deep Chains

```
your-app
  └── package-a@1.0.0
       └── package-b@2.0.0
            └── package-c@3.0.0  ← vulnerability here
```

**Risk**: You don't control `package-c`, and updating `package-a` may not update it.

### Detection

```bash
# Show dependency tree
npm ls --all --json | jq '.dependencies'

# Find deep chains (>4 levels)
npm ls --all 2>/dev/null | grep -E "^.{16,}" | head -20
```

### Mitigation

| Strategy | When |
|----------|------|
| `overrides` (npm) / `resolutions` (yarn) | Force specific version |
| Replace parent package | If parent is unmaintained |
| Vendor and patch | Last resort for critical fixes |

## Unused Dependencies

### Detection

```bash
# JavaScript
npx depcheck

# Python
pip-extra-reqs --ignore-module=tests .
```

### What to Flag

- Installed but never imported → MEDIUM (bloat, attack surface)
- Dev dependency in production deps → LOW (no runtime risk)
- Multiple packages for same purpose → LOW (e.g., both lodash and underscore)
