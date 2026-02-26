---
title: "PR Body Structure"
impact: "HIGH"
impactDescription: "Missing PR body sections slow down review and lose context for future maintainers"
tags: [pr, body, template, structure]
---

## PR Body Structure

Every PR body must include standard sections. Use `gh pr create --body` with a HEREDOC for correct formatting.

**Required sections:**

1. **Summary** — 1-2 sentences describing what and why (not how)
2. **Changes** — Bulleted list of what changed (for quick scanning)
3. **Test Plan** — Checkbox list of verification steps taken
4. **Issue reference** — `Closes #N` to auto-close the linked issue on merge

**Optional sections (include when relevant):**

- **Breaking Changes** — Migration steps if behavior changes
- **Screenshots** — For UI changes
- **Deployment Notes** — Environment variables, migrations, infrastructure

**Key rules:**
- Always use `Closes #N` (not `Fixes` or `Resolves`) for consistency with CI auto-close
- End body with `Generated with [Claude Code](https://claude.com/claude-code)` footer
- Use `--body "$(cat <<'EOF' ... EOF)"` HEREDOC pattern for multi-line bodies
- Keep Summary focused on "why" — the diff shows "what"
- Test Plan checkboxes should reflect actual verification, not aspirational items

**Anti-patterns:**
- Empty PR body (even for tiny changes, include Summary + Test Plan)
- Copy-pasting the full diff into the body
- Generic "Updated files" without specifics
- Unchecked test plan items (means tests were not actually run)

Reference: See `references/pr-body-templates.md` for full template examples.
