# Audit Output Format

## Summary Table

```
Skill                                    Lines   FM Rules Refs  Mfst Status
---------------------------------------------------------------------------
<skill-name>                              NNN   OK     N    N   YES  PASS
<skill-name>                              NNN  WARN     N    N   YES  WARN
  WARN: missing_fm:version,author
<skill-name>                              NNN   OK     0    0    NO  FAIL
  FAIL: not_in_manifest
  WARN: no_rules_or_refs
---------------------------------------------------------------------------
Total: N skills | PASS: X | WARN: Y | FAIL: Z
```

## Column Definitions

| Column | Width | Values | Meaning |
|--------|-------|--------|---------|
| Skill | 40 chars, left-aligned | `<dir-name>` | Directory name under `src/skills/` |
| Lines | 5 chars, right-aligned | integer | Line count of SKILL.md |
| FM | 4 chars, right-aligned | `OK` / `WARN` | All required frontmatter present? |
| Rules | 5 chars, right-aligned | integer | Non-template rule files in `rules/` |
| Refs | 4 chars, right-aligned | integer | Files in `references/` |
| Mfst | 5 chars, right-aligned | `YES` / `NO` | Registered in ork.json or orkl.json? |
| Status | — | `PASS` / `WARN` / `FAIL` | Overall result |

## Detail Lines

For each non-PASS skill, print indented detail lines directly below its table row:

```
  FAIL: <reason>
  WARN: <reason>
```

Multiple conditions each get their own line.

## Totals Line

Always show at the end:

```
Total: N skills | PASS: X | WARN: Y | FAIL: Z
```

Where N = X + Y + Z.
