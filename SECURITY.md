# Security Policy

OrchestKit ships skills, agents, and hooks that run inside your coding agent and,
through hooks, execute on your machine. That makes supply-chain trust part of the
product, not an afterthought. This document states what we do about it and how to
report a problem.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting: [**Report a vulnerability**](https://github.com/yonatangross/orchestkit/security/advisories/new)
(private vulnerability reporting is enabled on this repository).

If you cannot use GitHub advisories, open a public issue containing **only** a
request for a private channel — no details, no reproduction — and you will be
contacted to continue privately.

Please include: the affected skill / agent / hook, the version or commit, what an
attacker can achieve, and a reproduction if you have one.

| Stage | Target |
|---|---|
| Acknowledgement | within 3 business days |
| Initial assessment | within 7 days |
| Fix or documented mitigation for a confirmed critical issue | within 14 days |

This is a solo-maintained project. Those are honest targets, not an enterprise SLA.
If a deadline is going to slip, you will be told rather than left waiting.

## Scope

In scope:

- Prompt injection or "toxic flow" reachable through a shipped skill or agent
  (content that steers an agent into an action the user did not ask for).
- Command execution, path traversal, or privilege escalation in a hook.
- Credential or secret exposure — anything that reads, logs, or transmits tokens,
  environment variables, or file contents beyond what a skill needs.
- Data exfiltration through a skill's documented network calls or MCP wiring.
- A dependency vulnerability that OrchestKit actually reaches at runtime.

Out of scope:

- Vulnerabilities in Claude Code, the `skills` CLI, skills.sh, or any upstream
  package we merely document — report those to the respective vendor.
- Social engineering, physical attacks, or issues requiring an already-compromised
  machine.
- Findings that require the user to paste attacker-controlled content directly
  into their own prompt, with no involvement from a shipped artifact.

## What we do proactively

- **Automated scanning on every install.** Skills distributed through
  [skills.sh](https://skills.sh) are scanned by Snyk on install across its policy
  categories, including malicious code, prompt injection, toxic flows, suspicious
  downloads, and exposed credentials.
- **CI gates.** CodeQL, dependency review with Dependabot auto-merge for patches,
  an OpenSSF Scorecard run, secret-audit hooks, and hook-contract tests run on the
  repository. Third-party GitHub Actions are pinned by commit SHA.
- **Upstream version tracking.** `scripts/check-labs-versions.mjs` re-checks each
  skill's declared `upstream-version-tested` pin and dependency floors against the
  live npm and PyPI registries on a schedule, so documented versions cannot drift
  silently away from what a skill actually teaches.
- **No secrets in the tree.** Configuration is referenced, never inlined.

## Hooks deserve extra scrutiny

Hooks are the highest-privilege surface here: they run shell or Node/Python on
your machine on agent events. If you are evaluating OrchestKit for a team, read
`src/hooks/` and `src/hooks/README.md` first. Every hook is designed to
**fail open** — an error must never block your work — and none should ever
transmit repository contents off-machine. A hook that violates either property is
a security bug under this policy; please report it.

## Supported versions

Security fixes land on the latest release. There is no long-term-support branch;
upgrade to the current version to receive them.

## Disclosure

We prefer coordinated disclosure. Report privately, give us the window above, and
we will credit you in the advisory and the changelog unless you ask otherwise.
