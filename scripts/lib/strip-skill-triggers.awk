# Delete the object-shaped `triggers` frontmatter block from a SKILL.md
# stream: the `triggers:` line plus its indented children, inside the
# frontmatter fence only. Shared by scripts/build-plugins.sh (built copy)
# and tests/plugins/test-build-drift.sh (src-side normalization), so the
# two never diverge on what "stripped" means. #4147
NR==1 && $0=="---" { infm=1 }
infm && NR>1 && $0=="---" { infm=0 }
infm && /^triggers:/ { drop=1; next }
infm && drop && /^[ \t]/ { next }
{ drop=0; print }
