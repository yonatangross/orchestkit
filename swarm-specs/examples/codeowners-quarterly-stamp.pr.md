## Summary

Quarterly CODEOWNERS review stamp: `# Last reviewed: 2026-Q2`.

This PR is one of N opened by `/ork:swarm-migrate` from the spec
`swarm-specs/examples/codeowners-quarterly-stamp.yaml`. The transform is
idempotent — re-running the spec on this repo is a no-op once merged.

## Change

A single line prepended to `.github/CODEOWNERS`:

```
# Last reviewed: 2026-Q2
```

No code paths or ownership rules changed.

## Why

Quarterly reminder for owners to review the file. No tooling depends on
the header; if anyone cares to track the cadence, grep for
`# Last reviewed: 2026-` across repos.

## Test plan

- [ ] `grep "Last reviewed: 2026-Q2" .github/CODEOWNERS` returns the line
- [ ] File is otherwise byte-identical to main except for the header
- [ ] No CI checks were required (CODEOWNERS edits don't trigger build)
