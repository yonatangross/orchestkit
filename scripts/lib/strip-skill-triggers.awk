# Delete the object-shaped `triggers` frontmatter block from a SKILL.md
# stream: the `triggers:` line plus its children, inside the frontmatter
# fence only. A child is an indented line, a blank line, or a `- ` sequence
# item at any indent (YAML allows zero-indent sequences); the block ends at
# the next top-level `key:` line, a non-child line such as a comment, or
# the closing fence. Fences tolerate trailing whitespace and CRLF.
#
# Frontmatter is buffered until its closing fence: an opening `---` with no
# closing delimiter is malformed frontmatter (plain Markdown), so the
# buffered lines are emitted verbatim and no body `triggers:` text is ever
# removed. Shared by scripts/build-plugins.sh (built copy) and
# tests/plugins/test-build-drift.sh (src-side normalization), so the two
# never diverge on what "stripped" means. #4147
NR==1 && /^---[ \t\r]*$/ { infm=1; buf[++n]=$0; next }
infm && /^---[ \t\r]*$/ {
  # Closing fence found: emit the buffered frontmatter with the triggers
  # block removed, then the fence itself.
  print buf[1]
  for (i = 2; i <= n; i++) {
    line = buf[i]
    if (line ~ /^triggers:/) { drop=1; continue }
    if (drop && line ~ /^[A-Za-z0-9_-]+:/) { drop=0; print line; continue }
    if (drop && (line ~ /^[ \t-]/ || line ~ /^[ \t\r]*$/)) continue
    drop=0; print line
  }
  infm=0; print; next
}
infm { buf[++n]=$0; next }
{ print }
END { if (infm) for (i = 1; i <= n; i++) print buf[i] }
