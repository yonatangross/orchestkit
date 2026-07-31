# GitHub Projects v2

`gh project` covers listing and adding items; custom-field writes are GraphQL only.
The mutation shapes, field-value unions, and field/option ID discovery queries are
documented upstream and are not restated here.

> Kept on disk deliberately: `tests/skills/test-github-operations-completeness.sh`
> asserts this exact filename.

## Upstream

| Topic | Source |
|-------|--------|
| `updateProjectV2ItemFieldValue`, single-select / text / number / iteration value shapes, field and option ID discovery, org vs user project queries | https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects |
| `gh project list/view/item-add/item-delete/field-list` | https://cli.github.com/manual/gh_project |
| Adding items to a project | https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project |
| GraphQL mutation reference | https://docs.github.com/en/graphql/reference/mutations |

## Our delta

Full rules with rationale: [ork-delta.md](ork-delta.md).

1. **Two identifiers, one project.** `gh project` subcommands take the project
   NUMBER from the URL; every GraphQL mutation needs the `PVT_...` node_id. Mixing
   them fails without a useful error. Mapping stays in this skill:
   [cli-vs-api-identifiers.md](cli-vs-api-identifiers.md).
2. **Field IDs are per project, never hardcode them across repos.** Resolve
   `field-list` output at run time, or the mutation silently writes the wrong field.
3. **Order matters:** create the issue, capture its URL, `item-add` to get the item
   id, then set fields. There is no single call that does all three.

```bash
# Discover ids for a project before any field mutation.
gh project field-list 1 --owner @me --format json
gh project list --owner @me --format json --jq '.projects[] | {number, id}'
```
