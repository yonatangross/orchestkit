---
title: License Compliance
impact: MEDIUM
---

# License Compliance

When installing new dependencies, check their license before adding to production projects.

## Problematic Licenses

Avoid packages with these licenses unless explicitly approved:
- **GPL-2.0 / GPL-3.0** — Copyleft, may require open-sourcing your code
- **AGPL-3.0** — Network copyleft, triggers on server-side use
- **LGPL-2.1 / LGPL-3.0** — Lesser copyleft, still has linking requirements
- **CC-BY-NC** — Non-commercial only
- **SSPL** — Server Side Public License, restrictive for SaaS

## Before Adding Dependencies

1. Check the license: `npm view <package> license`
2. Prefer permissive licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC
3. For Python: `pip show <package>` to check license metadata
4. When in doubt, flag the dependency for review before committing
