---
title: Verify what you install, not just what you wrote — lockfile integrity, provenance, and dependency confusion
impact: CRITICAL
impactDescription: "Software Supply Chain Failures is A03 in OWASP Top 10:2025. Scanning your own code and auditing CVEs does not detect a compromised release, a typosquatted name, or an internal package shadowed from a public registry"
tags: supply-chain, sbom, slsa, sigstore, provenance, lockfile, dependency-confusion, typosquatting, npm, pip, attestation, owasp-a03-2025
---

## Supply Chain Integrity

`scanning.md` answers "does anything I depend on have a known CVE?". This rule
answers a different question: "is the thing I installed the thing the maintainer
published?". A package can be fully CVE-clean and still malicious.

## Lockfile integrity

**Incorrect — install resolves fresh every time:**
```bash
npm install          # may pick up a newer transitive release
pip install -r requirements.txt   # unpinned transitives
```

**Correct — install exactly what was reviewed:**
```bash
npm ci               # fails if package.json and the lockfile disagree
pip install --require-hashes -r requirements.txt
uv sync --frozen
```

`npm ci` is not a faster `npm install`. It refuses to proceed when the lockfile
does not match, which is precisely the signal you want in CI.

## Dependency confusion

An internal package name that also exists on a public registry can be shadowed,
because many resolvers prefer the highest version across all configured sources.

**Correct — scope internal packages and pin the source:**
```
# .npmrc
@yourorg:registry=https://registry.internal.example/
```
```toml
# pyproject.toml — do not let a public index satisfy an internal name
[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example/simple"
explicit = true
```

Publish a placeholder of every internal name to the public registry, or use a
scope you own. An unscoped internal name is a standing invitation.

## Provenance and attestation

Verify that a release was built by the pipeline it claims, not uploaded by hand.

```bash
npm audit signatures                  # registry signing + provenance
gh attestation verify ./dist.tgz --owner yourorg
cosign verify-blob --bundle dist.sig ./dist.tgz
```

SLSA build levels describe how much this is worth: L1 means provenance exists,
L2 means it is signed by a hosted builder, L3 means the build is isolated and
non-falsifiable. Ask which level a critical dependency actually meets rather
than assuming a green badge implies L3.

## Typosquatting and install-time execution

Most supply-chain compromise runs at INSTALL time, before any of your code does.

```bash
npm ci --ignore-scripts               # then run known-good scripts explicitly
```

Check a new dependency before adding it: publish date versus first release,
download counts against its age, whether the repo link resolves, and whether the
name is one character from something popular.

## SBOM

Generate an SBOM per release so an advisory can be answered with a query instead
of a guess.

```bash
syft dir:. -o cyclonedx-json > sbom.json
grype sbom:sbom.json --fail-on high
```

**Key rules:**
- Use `npm ci` / `--require-hashes` / `--frozen` in CI. Never a fresh resolve.
- Scope internal packages and pin their registry. Unscoped internal names are shadowable.
- Verify provenance for anything in the build or release path, not just runtime deps.
- Treat install scripts as executable untrusted code: `--ignore-scripts` by default.
- Emit an SBOM per release. Without one, "are we affected?" has no cheap answer.
- A CVE scan does not detect a compromised release. These are different controls.

Reference: OWASP Top 10:2025 A03 Software Supply Chain Failures · SLSA v1.0 · CycloneDX
