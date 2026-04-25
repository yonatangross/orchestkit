# `--from-pr` Multi-Host Support

CC 2.1.119 extends `--from-pr` to accept GitLab MR, Bitbucket PR, and GitHub Enterprise URLs in addition to github.com. OrchestKit's PR-related skills (`review-pr`, `create-pr`, `fix-issue`) adopt this in M122.

**Closes:** part of #1502 (M122-5). Reference for skill authors.

## Supported Hosts

| Host family | URL pattern | Detection regex |
|---|---|---|
| github.com (public) | `https://github.com/{owner}/{repo}/pull/{n}` | `^https://github\.com/` |
| GitHub Enterprise | `https://{host}/{owner}/{repo}/pull/{n}` (host suffix `.github.<corp>`) | `\.github\.[a-z]+/` |
| GitLab.com | `https://gitlab.com/{owner}/{repo}/-/merge_requests/{n}` | `^https://gitlab\.com/` |
| Self-hosted GitLab | `https://gitlab.{corp}/{group}/{repo}/-/merge_requests/{n}` | `^https://gitlab\.` |
| Bitbucket Cloud | `https://bitbucket.org/{owner}/{repo}/pull-requests/{n}` | `^https://bitbucket\.org/` |

## Skill Adoption

Skills that previously assumed `github.com`:

- `src/skills/review-pr/SKILL.md` — review existing PR (any host)
- `src/skills/create-pr/SKILL.md` — push branch + open PR (host-aware)
- `src/skills/fix-issue/SKILL.md` — branch from issue/MR (host-aware)

Each skill should:
1. Parse the URL with the host-detector helper (`src/hooks/src/lib/pr-host-parser.ts`).
2. Branch on `host_family` for host-specific behaviors:
   - GitHub: `gh pr view/edit/checks` (existing path)
   - GitLab: `glab mr view/edit` (or REST `/projects/:id/merge_requests/:iid`)
   - Bitbucket: `bb pr` (or REST `/repositories/:ws/:repo/pullrequests/:id`)
3. Fall back to `github.com` defaults when host is unrecognized — never crash.

## Configuration: `prUrlTemplate`

CC 2.1.119 added a `prUrlTemplate` setting (in `~/.claude/settings.json` or project-level) for custom code-review URL formatting:

```json
{
  "prUrlTemplate": "https://gitlab.acme.com/{owner}/{repo}/-/merge_requests/{n}"
}
```

When set, skills should consult this template before constructing PR/MR URLs. Document it in `src/skills/configure/references/`.

## Anti-Patterns

| Don't | Do |
|---|---|
| Hardcode `github.com` in skill copy | Parameterize via the host-detector helper |
| Assume `gh` CLI is available for non-GitHub | Fall back to REST or document the dependency |
| Crash on unrecognized URL | Default to `github.com` parsing + warn |
| Mix branch detection (push-side) with PR detection (review-side) | Keep them in separate parsers |

## Reference Implementation

`src/hooks/src/lib/pr-host-parser.ts` exports:

```ts
export interface PrHostInfo {
  host: string;
  family: 'github' | 'github-enterprise' | 'gitlab' | 'gitlab-self' | 'bitbucket' | 'unknown';
  owner: string;
  repo: string;
  pr_id: number;
}

export function parsePrUrl(url: string): PrHostInfo | null;
```

Tests in `src/hooks/src/__tests__/pr-host-parser.test.ts` cover all 5 host families with real-world URL fixtures.

## Migration Checklist

When converting a skill from github.com-only to multi-host:

- [ ] Import `parsePrUrl` from `src/hooks/src/lib/pr-host-parser.ts`
- [ ] Replace `github.com` regex with parser call
- [ ] Branch on `family` for any CLI/REST calls
- [ ] Document `prUrlTemplate` in the skill's configuration section
- [ ] Add fixture tests for at least 3 host families
- [ ] Update SKILL.md with explicit support table

## Related

- `src/skills/review-pr/SKILL.md` — PR review skill (multi-host adopted)
- `src/skills/create-pr/SKILL.md` — PR creation skill (multi-host adopted)
- `src/skills/fix-issue/SKILL.md` — issue-to-branch skill (multi-host adopted)
- `src/skills/configure/references/` — `prUrlTemplate` documentation
