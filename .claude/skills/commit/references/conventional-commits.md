# Conventional Commits

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | Description | Bumps |
|------|-------------|-------|
| `feat` | New feature for users | MINOR |
| `fix` | Bug fix for users | PATCH |
| `docs` | Documentation only | - |
| `style` | Formatting, no code change | - |
| `refactor` | Code change, no feature/fix | - |
| `perf` | Performance improvement | PATCH |
| `test` | Adding/fixing tests | - |
| `chore` | Build process, deps | - |
| `ci` | CI configuration | - |
| `revert` | Revert previous commit | - |

## Breaking Changes

Add `!` after type or `BREAKING CHANGE:` in footer:

```
feat!: drop support for Node 14

BREAKING CHANGE: Node 14 is no longer supported
```

## Scope Examples

- `feat(auth): add OAuth2 support`
- `fix(api): handle null response`
- `docs(readme): update install steps`
- `refactor(core): extract helper functions`

## Good Examples

```
feat(#123): add user profile page

- Create ProfilePage component
- Add profile API endpoint
- Include unit tests

Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix(#456): prevent XSS in comment display

Sanitize HTML in user comments before rendering.

Co-Authored-By: Claude <noreply@anthropic.com>
```