# Delete the object-shaped `triggers` frontmatter block from a SKILL.md
# stream: the `triggers:` line plus its children, inside the frontmatter
# fence only. A child is an indented line, a blank line, or a `- ` sequence
# item at any indent (YAML allows zero-indent sequences); the block ends at
# the next top-level `key:` line, a non-child line such as a comment, or
# the closing fence. Fences tolerate trailing whitespace and CRLF. Shared
# by scripts/build-plugins.sh (built copy) and
# tests/plugins/test-build-drift.sh (src-side normalization), so the two
# never diverge on what "stripped" means. #4147
NR==1 && /^---[ \t\r]*$/ { infm=1; print; next }
infm && /^---[ \t\r]*$/ { infm=0; print; next }
infm && /^triggers:/ { drop=1; next }
infm && drop && /^[A-Za-z0-9_-]+:/ { drop=0; print; next }
infm && drop && (/^[ \t-]/ || /^[ \t\r]*$/) { next }
infm && drop { drop=0; print; next }
{ print }
