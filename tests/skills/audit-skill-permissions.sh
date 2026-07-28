#!/usr/bin/env bash
# Automated Skill Permission Audit for CC 2.1.19
# Scans all skills and identifies those needing allowed-tools declarations,
# and asserts that every declared allowed-tools list actually COVERS the tools
# the skill body instructs the model to call.

set -euo pipefail

# Default resolved from THIS script's location, not the caller's cwd. The old
# default was the bare relative path "skills", which exists nowhere in this repo
# (skills live in src/skills). Invoked with no argument the scan therefore
# matched zero directories, reported "Total Skills: 0" and exited 0. A gate that
# silently passes because it looked in the wrong place is worse than no gate, and
# it is the same defect class this gate was written to catch.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILLS_DIR="${1:-$REPO_ROOT/src/skills}"
REPORT_FILE="${2:-/tmp/skill-permission-audit.md}"

# Refuse to pass vacuously. Either of these means the scan is not measuring what
# it claims, so fail loudly rather than reporting a clean sheet.
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo "FATAL: skills directory not found: $SKILLS_DIR" >&2
    exit 3
fi
if ! compgen -G "$SKILLS_DIR/*/SKILL.md" >/dev/null; then
    echo "FATAL: no SKILL.md files under $SKILLS_DIR, refusing to report a vacuous pass" >&2
    exit 3
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
total_skills=0
user_invocable=0
needs_tools=0
has_tools=0
coverage_checked=0
coverage_violations=0
coverage_exempt=0

# Arrays for tracking
declare -a skills_needing_update=()
declare -a skills_with_bash=()
declare -a skills_with_write=()
# Entries are "skill-name|Tool1 Tool2 ..." (bash 3.2 has no associative arrays)
declare -a coverage_failures=()
declare -a coverage_exempt_names=()

# ---------------------------------------------------------------------------
# Tool coverage assertion
# ---------------------------------------------------------------------------
# Closed vocabulary of Claude Code tool names. A body occurrence only counts as
# "the skill instructs this tool" when the name is in this list. Anything not
# listed here is ignored, so library constructors that happen to be CapitalCase
# (Path(), Column(), Field(), StateGraph(), Command()) can never trip the check.
#
# MCP tool ids (mcp__memory__search_nodes and friends) are deliberately absent:
# they appear in bodies in too many shapes (prose, bullet lists, YAML) to match
# call-shaped with any confidence.
KNOWN_TOOLS="Read Write Edit NotebookEdit Bash BashOutput KillShell Glob Grep \
Agent Task TaskCreate TaskUpdate TaskList TaskGet TaskStop \
AskUserQuestion WebFetch WebSearch ToolSearch Skill SlashCommand TodoWrite \
SendMessage PushNotification Monitor Workflow \
CronCreate CronDelete CronList EnterWorktree ExitWorktree \
DesignSync LSP RemoteTrigger"

# Emit only the YAML frontmatter (between the leading --- and its closer).
frontmatter_of() {
    awk '
        NR == 1 && /^---[[:space:]]*$/ { inside = 1; next }
        inside && /^---[[:space:]]*$/  { exit }
        inside                          { print }
    ' "$1"
}

# Emit only the Markdown body (everything after the frontmatter closer).
# A file with no frontmatter yields nothing, which is fine: such a file also
# has no allowed-tools key and is therefore skipped by the caller.
body_of() {
    awk '
        NR == 1 && /^---[[:space:]]*$/ { inside = 1; next }
        inside && /^---[[:space:]]*$/  { inside = 0; body = 1; next }
        body                            { print }
    ' "$1"
}

# Emit one declared tool name per line. Handles both YAML shapes in use:
#   allowed-tools: [Read, Bash, Grep]       (flow sequence)
#   allowed-tools:                          (block sequence)
#     - Read
#     - Bash
# A scoped declaration such as Bash(git status:*) is reduced to Bash.
declared_tools_of() {
    frontmatter_of "$1" | awk '
        function emit(s,   n, parts, i, t) {
            gsub(/[][",]/, " ", s)
            n = split(s, parts, /[ \t]+/)
            for (i = 1; i <= n; i++) {
                t = parts[i]
                sub(/\(.*$/, "", t)
                if (t != "") print t
            }
        }
        /^allowed-tools:/ {
            grab = 1
            rest = $0
            sub(/^allowed-tools:[[:space:]]*/, "", rest)
            emit(rest)
            next
        }
        grab && /^[[:space:]]+-[[:space:]]*/ {
            rest = $0
            sub(/^[[:space:]]+-[[:space:]]*/, "", rest)
            emit(rest)
            next
        }
        grab && /^[^[:space:]]/ { grab = 0 }
    ' | sort -u
}

# Print the tools a body instructs but its own allowed-tools does not permit.
#
# WHAT THIS CATCHES
#   Call-shaped occurrences in the body: `ToolName(` where the name is in
#   KNOWN_TOOLS, is not preceded by an identifier character or a dot, and the
#   open paren is followed by something other than an immediate `)`. That covers
#   both single-line calls, Read("${CLAUDE_SKILL_DIR}/ref.md"), and multi-line
#   calls whose arguments start on the next line, Agent( at end of line.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH (false-positive control: an honest
# narrow check that passes cleanly beats a broad one that gets disabled)
#   * Prose mentions with no call parens: "use the Read tool", "Bash is fine".
#   * Empty-paren prose forms: "pass MODEL_OVERRIDE to all Agent() calls".
#   * Method or attribute calls in code samples: self.Read(x), client.Bash(y).
#   * Tool names owned by some OTHER skill or agent when written without call
#     parens (skills: [...] lists, tables, "the verify skill uses Agent").
#   * Anything under the skill's scripts/ or references/ directories.
#   * MCP tool ids, which have no reliable call shape in these bodies.
#   * Fenced code blocks are NOT excluded. In this repo the fences are the
#     primary way a skill instructs a tool call, so excluding them would gut
#     the check. The closed vocabulary is what keeps illustrative third-party
#     code in those fences from registering.
#
# A skill with NO allowed-tools key inherits the full tool set, so it is
# unconstrained and cannot violate this check. Callers must skip those.
uncovered_tools_of() {
    local skill_md="$1"
    local instructed allowed tool uncovered=""

    # One awk pass over the body collects every call-shaped known-tool name.
    # awk (not a grep-per-tool loop) keeps this at two subprocesses per skill
    # instead of ~35, and awk always exits 0 so `pipefail` has nothing to trip on.
    instructed=$(body_of "$skill_md" | awk -v vocab="$KNOWN_TOOLS" '
        BEGIN { n = split(vocab, v, " "); for (i = 1; i <= n; i++) known[v[i]] = 1 }
        {
            line = $0
            while (match(line, /[A-Za-z_][A-Za-z0-9_]*\(/)) {
                name   = substr(line, RSTART, RLENGTH - 1)
                before = (RSTART > 1) ? substr(line, RSTART - 1, 1) : ""
                # substr past end of line yields "", i.e. a call whose args
                # continue on the next line. That still counts as a call.
                after  = substr(line, RSTART + RLENGTH, 1)
                if ((name in known) && after != ")" && before !~ /[A-Za-z0-9_.]/) {
                    hit[name] = 1
                }
                line = substr(line, RSTART + RLENGTH)
            }
        }
        END { for (k in hit) print k }
    ' | sort -u)

    # Flat space-delimited string so membership is a builtin case match, no fork.
    allowed=" $(declared_tools_of "$skill_md" | tr '\n' ' ')"

    for tool in $instructed; do
        case "$allowed" in
            *" $tool "*) ;;
            *) uncovered="$uncovered $tool" ;;
        esac
    done

    printf '%s' "${uncovered# }"
}

echo -e "${BLUE}=== Skill Permission Audit (CC 2.1.19) ===${NC}"
echo ""

# Start report
cat > "$REPORT_FILE" << 'EOF'
# Skill Permission Audit Report

## Summary

EOF

# Scan each skill
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    skill_md="$skill_dir/SKILL.md"

    if [[ ! -f "$skill_md" ]]; then
        continue
    fi

    # Plain assignment, not ((n++)): post-increment from 0 returns exit status 1
    # and `set -e` would abort the whole audit on the very first skill.
    total_skills=$((total_skills + 1))

    # --- Coverage assertion -------------------------------------------------
    # Applies to EVERY skill that declares allowed-tools, user-invocable or not.
    # Skills without the key inherit everything and are skipped.
    #
    # ESCAPE HATCH, a FRONTMATTER key, deliberately explicit and greppable:
    #     tool-coverage: illustrative
    # It lives in frontmatter, not the body, for two reasons. It is metadata
    # rather than prose, and an HTML comment in the body breaks the docs-site
    # build: SKILL.md bodies are published as MDX, and MDX rejects `<!-- -->`
    # ("Unexpected character `!` before name"). The first version of this hatch
    # was a body comment and it broke tests/unit/test-mdx-compile.sh on 2 files.
    # Matched anchored (^) so prose inside a fenced block cannot self-exempt.
    # A reference skill exists to TEACH a pattern, so its fenced calls are
    # documentation rather than calls the skill itself makes. Widening such a
    # skill's allowed-tools to satisfy this check would grant real permissions
    # (Agent, CronCreate) to something that never acts, which is the opposite of
    # what allowed-tools is for. The marker records that judgement in the file
    # instead, so `grep -rn 'tool-coverage: illustrative' src/skills` lists every
    # exemption for review. Matches the house pattern used by model-recency-ok,
    # ascii-lint-disable and rtl-ok.
    if grep -q "^allowed-tools:" "$skill_md"; then
        if grep -q "^tool-coverage: illustrative" "$skill_md"; then
            coverage_exempt=$((coverage_exempt + 1))
            coverage_exempt_names+=("$skill_name")
        else
            coverage_checked=$((coverage_checked + 1))
            uncovered=$(uncovered_tools_of "$skill_md")
            if [[ -n "$uncovered" ]]; then
                coverage_violations=$((coverage_violations + 1))
                coverage_failures+=("$skill_name|$uncovered")
            fi
        fi
    fi

    # Check if user-invocable
    if grep -q "^user-invocable: true" "$skill_md"; then
        user_invocable=$((user_invocable + 1))

        # Check for allowed-tools
        if grep -q "^allowed-tools:" "$skill_md"; then
            has_tools=$((has_tools + 1))
        else
            # Check if skill has scripts that use dangerous tools
            has_bash=false
            has_write=false

            # Check scripts directory
            if [[ -d "$skill_dir/scripts" ]]; then
                for script in "$skill_dir/scripts"/*; do
                    if [[ -f "$script" ]]; then
                        # Check script content for tool usage patterns
                        if grep -qE "Bash|npm |pip |git |docker " "$script"; then
                            has_bash=true
                        fi
                        if grep -qE "Write|Edit|cat.*>" "$script"; then
                            has_write=true
                        fi
                    fi
                done
            fi

            # Check SKILL.md for tool usage hints
            if grep -qiE "run.*command|execute|npm|pip|git|docker|bash" "$skill_md"; then
                has_bash=true
            fi
            if grep -qiE "create.*file|write.*file|edit.*file|generate.*file" "$skill_md"; then
                has_write=true
            fi

            if $has_bash || $has_write; then
                needs_tools=$((needs_tools + 1))
                skills_needing_update+=("$skill_name")

                if $has_bash; then
                    skills_with_bash+=("$skill_name")
                fi
                if $has_write; then
                    skills_with_write+=("$skill_name")
                fi
            fi
        fi
    fi
done

# Print results
echo -e "${GREEN}Total Skills:${NC} $total_skills"
echo -e "${GREEN}User-Invocable:${NC} $user_invocable"
echo -e "${GREEN}With allowed-tools:${NC} $has_tools"
echo -e "${YELLOW}Needing allowed-tools:${NC} $needs_tools"
echo -e "${GREEN}Coverage-checked (declare allowed-tools):${NC} $coverage_checked"
if [[ $coverage_violations -gt 0 ]]; then
    echo -e "${RED}Coverage violations:${NC} $coverage_violations"
else
    echo -e "${GREEN}Coverage violations:${NC} 0"
fi
echo ""

if [[ ${#skills_needing_update[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Skills needing allowed-tools declarations:${NC}"
    for skill in "${skills_needing_update[@]}"; do
        echo "  - $skill"
    done
    echo ""
fi

if [[ ${#coverage_failures[@]} -gt 0 ]]; then
    echo -e "${RED}FAIL: allowed-tools does not cover the tools these bodies instruct:${NC}"
    for entry in "${coverage_failures[@]}"; do
        echo "  - ${entry%%|*}: missing ${entry#*|}"
    done
    echo ""
    echo -e "${YELLOW}Fix by adding the listed tools to that skill's allowed-tools,${NC}"
    echo -e "${YELLOW}or by removing the call-shaped example from the body.${NC}"
    echo ""
fi

# Complete report
cat >> "$REPORT_FILE" << EOF
| Metric | Count |
|--------|-------|
| Total Skills | $total_skills |
| User-Invocable | $user_invocable |
| With allowed-tools | $has_tools |
| Needing allowed-tools | $needs_tools |
| Coverage-checked | $coverage_checked |
| Coverage violations | $coverage_violations |

## Tool Coverage Violations

Skills whose \`allowed-tools\` omits a tool their own body instructs
call-shaped (\`ToolName(\`).

EOF

if [[ ${#coverage_failures[@]} -gt 0 ]]; then
    {
        echo "| Skill | Missing from allowed-tools |"
        echo "|-------|----------------------------|"
        for entry in "${coverage_failures[@]}"; do
            echo "| \`${entry%%|*}\` | \`${entry#*|}\` |"
        done
        echo ""
    } >> "$REPORT_FILE"
else
    echo "None. Every skill that declares allowed-tools covers the tools its body instructs." >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << 'EOF'
## Skills Needing Update

EOF

if [[ ${#skills_needing_update[@]} -gt 0 ]]; then
    for skill in "${skills_needing_update[@]}"; do
        echo "- \`$skill\`" >> "$REPORT_FILE"

        # Add recommended tools
        tools=""
        for bash_skill in "${skills_with_bash[@]}"; do
            if [[ "$bash_skill" == "$skill" ]]; then
                tools="Bash"
                break
            fi
        done
        for write_skill in "${skills_with_write[@]}"; do
            if [[ "$write_skill" == "$skill" ]]; then
                if [[ -n "$tools" ]]; then
                    tools="$tools, Write, Edit"
                else
                    tools="Write, Edit"
                fi
                break
            fi
        done

        if [[ -n "$tools" ]]; then
            echo "  - Recommended: \`allowed-tools: [$tools]\`" >> "$REPORT_FILE"
        fi
    done
else
    echo "All user-invocable skills have proper allowed-tools declarations." >> "$REPORT_FILE"
fi

echo ""
echo -e "${BLUE}Report saved to:${NC} $REPORT_FILE"

# Distinct exit codes, because "exit 1" for two unrelated conditions made a red
# run uninformative: you could not tell a broken skill from an advisory nudge.
#   2 = COVERAGE VIOLATION. Hard failure. The skill instructs a tool it is not
#       permitted to use, so it is broken at runtime, not merely under-declared.
#   1 = advisory only. Skills that ought to declare allowed-tools but do not.
#       These are unconstrained, so they cannot be broken by this check; the
#       count is a backlog signal, not a defect.
#   0 = clean.
# CI should gate on `-eq 2`. Treating 1 as fatal would block every PR until an
# unrelated backlog is burned down, which is how gates get disabled.
if [[ $coverage_violations -gt 0 ]]; then
    echo -e "${RED}FAIL(2): $coverage_violations skill(s) instruct tools their allowed-tools omits.${NC}"
    exit 2
elif [[ $needs_tools -gt 0 ]]; then
    echo -e "${YELLOW}ADVISORY(1): $needs_tools skill(s) should declare allowed-tools. Not a runtime defect.${NC}"
    exit 1
else
    exit 0
fi
