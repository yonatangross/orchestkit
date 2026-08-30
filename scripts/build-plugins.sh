#!/usr/bin/env bash
# ============================================================================
# OrchestKit Plugin Build Script
# ============================================================================
# Assembles plugin directories from source files and manifest definitions.
# Each plugin gets real directories (no symlinks) for Claude Code compatibility.
#
# Usage:
#   ./scripts/build-plugins.sh
#   npm run build
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_DIR="$PROJECT_ROOT/src"
MANIFESTS_DIR="$PROJECT_ROOT/manifests"
PLUGINS_DIR="$PROJECT_ROOT/plugins"

# Canonical identifier for the Agent Plugins 1.0.0 manifest schema. The value is
# fixed by the spec ("its value MUST be the canonical identifier"), so it is a
# constant, not a configurable. Clients MUST NOT fetch the schema while loading
# a plugin; it is a version selector, and this string is the version we target.
AGENT_PLUGINS_SCHEMA="https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Stats
PLUGINS_BUILT=0
TOTAL_SKILLS_COPIED=0
TOTAL_AGENTS_COPIED=0
TOTAL_COMMANDS_GENERATED=0

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}        OrchestKit Plugin Build System v2.4.0${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# ============================================================================
# Function: Generate command file from user-invocable skill
# ============================================================================
# Command wrappers for the CURSOR host (#3541, 2026-08-29).
#
# History: Claude Code once surfaced only commands/*.md as slash commands
# (anthropics/claude-code#18949), so every user-invocable skill was mirrored
# into commands/<name>.md. Probed at 2.1.226 (2026-08-08) and 2.1.234
# (2026-08-18): without the wrappers the loader reported 0 commands, so they
# were load-bearing then.
#
# Re-measured 2026-08-29 on 2.1.251 with the loopback Messages-API stub:
# `claude -p "/ork:glyph hello"` produces `<command-name>/ork:glyph</command-name>`
# in the first model request WITHOUT commands/, byte-identical to with it,
# while the request bodies show no skill listing at all (0 mentions in the
# system prompt or tool descriptions in either fixture). So the wrappers had
# stopped doing anything for CC except registering each invocable skill
# twice (`plugin details`: Skills (141) for 106 on disk, /ork:glyph three
# times in the palette).
#
# Cursor's loader still reads its manifest's `commands` path, so the wrappers
# are generated under .cursor-plugin/commands/ and referenced only from
# .cursor-plugin/plugin.json. Nothing at the default commands/ path, so CC's
# default scan finds nothing to double-register.
#
# `npm run verify:cc-commands` (scripts/probe-command-discovery.sh) is the
# tripwire in the other direction: it re-runs the expansion probe against the
# installed binary and exits 1 the day CC stops surfacing skills natively.
generate_command_from_skill() {
    local skill_md="$1"
    local command_file="$2"
    local skill_name="$3"

    # Extract frontmatter (lines between first --- and second ---)
    local frontmatter=$(sed -n '2,/^---$/p' "$skill_md" | sed '$d')

    # Extract description from frontmatter
    local description=$(echo "$frontmatter" | grep -E "^description:" | sed 's/^description: *//')

    # Extract allowed tools from frontmatter
    local allowed_tools=$(echo "$frontmatter" | grep -E "^allowed-tools:" | sed 's/^allowed-tools: *//')

    # Extract argument-hint. CC renders this as the ghost placeholder after the command name
    # ("/ork:visualize-plan [plan-or-issue]"). It is read from the COMMAND file, not the SKILL,
    # so dropping it here silently disables the hint for every command even though all 34
    # user-invocable skills declare one in source. Optional: emitted only when present.
    local argument_hint=$(echo "$frontmatter" | grep -E "^argument-hint:" | sed 's/^argument-hint: *//')

    # Every OTHER field CC reads from the command file. Custom commands were merged into
    # skills upstream, so both sides share one frontmatter schema:
    # https://code.claude.com/docs/en/slash-commands
    #
    # This is a LOOP, not a hand-written field per line, because the field-by-field form is
    # what dropped argument-hint (#3146) and then disable-model-invocation: adding a key
    # upstream required a human to remember this function existed. Adding a name here is now
    # the only edit. Keep aligned with MUST_SURVIVE in
    # tests/plugins/test-command-frontmatter-passthrough.sh, which fails the build on any
    # unclassified key.
    # `background` joined the list on 2026-08-02: #3239 added `background: false` to 23
    # user-invocable fork skills, but this function never forwarded it, so 0/35 command
    # files carried it and the opt-out was INERT on the slash-command path it was written
    # for. Exactly the drop this list exists to prevent — the third instance after
    # argument-hint (#3146) and disable-model-invocation.
    local PASSTHROUGH_KEYS=(disable-model-invocation model effort context agent user-invocable name background)

    # Default allowed tools if not specified
    if [[ -z "$allowed_tools" ]]; then
        allowed_tools="[Bash, Read, Write, Edit, Glob, Grep]"
    fi

    # Generate command file with frontmatter + skill content
    {
        echo "---"
        echo "description: $description"
        [[ -n "$argument_hint" ]] && echo "argument-hint: $argument_hint"
        # The `|| true` is load-bearing under `set -e`: a bare `val=$(... | grep ...)`
        # propagates grep's exit 1 when the key is absent and kills the build silently.
        # grep finding nothing here means "this skill did not declare that optional key",
        # which is the normal case, not an error. The `local x=$(...)` declarations above
        # survive the same hazard only by accident — `local` returns its own status.
        local key val
        for key in "${PASSTHROUGH_KEYS[@]}"; do
            # silent: known-noise
            val=$(echo "$frontmatter" | grep -E "^${key}:" | sed "s/^${key}: *//" || true)
            if [[ -n "$val" ]]; then
                echo "${key}: ${val}"
            fi
        done
        echo "allowed-tools: $allowed_tools"
        echo "---"
        echo ""
        echo "# Auto-generated from skills/$skill_name/SKILL.md"
        echo "# Source: https://github.com/yonatangross/orchestkit"
        echo ""
        # Skip the frontmatter from skill and include the rest (after second ---)
        awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$skill_md"
    } > "$command_file"
}

# ============================================================================
# Phase 1: Validate Environment
# ============================================================================
echo -e "${BLUE}[1/10] Validating environment...${NC}"

if [[ ! -d "$SRC_DIR" ]]; then
    echo -e "${RED}Error: src/ directory not found${NC}"
    exit 1
fi

if [[ ! -d "$MANIFESTS_DIR" ]]; then
    echo -e "${RED}Error: manifests/ directory not found${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

# Count manifests
MANIFEST_COUNT=$(find "$MANIFESTS_DIR" -name "*.json" -type f | wc -l | tr -d ' ')
echo -e "${GREEN}  Found $MANIFEST_COUNT manifests${NC}"
echo ""

# ============================================================================
# Phase 1.5: Ensure src/hooks/dist is fresh
# ============================================================================
# The hooks bundle is what actually runs at hook-invocation time. The rsync
# below copies whatever's in src/hooks/dist into plugins/ — if that bundle
# is stale (someone edited a hook but forgot `cd src/hooks && npm run build`),
# users get the old behavior with no warning. See the 2026-05-22 incident
# where plugins/ shipped an 8-day-old watchdog without a 24h zombie cap, and
# #2360 where a stale lifecycle.mjs broke every worktree-isolated agent spawn.
#
# HARD-FAIL policy (#2360): a failed esbuild step must abort the whole build —
# the old warn-and-continue path is exactly how stale bundles reached releases
# while the script still printed "BUILD COMPLETE".
HOOKS_DIR="$SRC_DIR/hooks"
if [[ -d "$HOOKS_DIR" && -f "$HOOKS_DIR/package.json" && -d "$HOOKS_DIR/node_modules" ]]; then
    echo -e "${BLUE}[1.5/10] Refreshing src/hooks/dist (esbuild)...${NC}"
    ( cd "$HOOKS_DIR" && npm run --silent build ) || {
        echo -e "${RED}  ERROR: src/hooks build failed — aborting (stale bundles must not ship, #2360)${NC}"
        echo -e "${RED}         Fix the esbuild error above, or run: cd src/hooks && npm run build${NC}"
        exit 1
    }
    echo -e "${GREEN}  Hooks bundle refreshed${NC}"
    echo ""
else
    # No node_modules → we cannot rebuild. The committed src/hooks/dist may be
    # used as-is ONLY if it actually exists; the CI drift gate verifies its
    # freshness (plugins/ + src/hooks/dist are both tracked and diffed).
    if [[ ! -f "$HOOKS_DIR/dist/lifecycle.mjs" ]]; then
        echo -e "${RED}[1.5/10] ERROR: src/hooks/node_modules missing AND src/hooks/dist is absent/incomplete${NC}"
        echo -e "${RED}         Run: cd src/hooks && npm ci && npm run build${NC}"
        exit 1
    fi
    echo -e "${YELLOW}[1.5/10] Skipping hooks rebuild — node_modules missing in $HOOKS_DIR${NC}"
    echo -e "${YELLOW}         Using committed src/hooks/dist (freshness enforced by CI drift gate)${NC}"
    echo ""
fi

# ============================================================================
# Phase 2: Clean Previous Build
# ============================================================================
echo -e "${BLUE}[2/10] Cleaning previous build...${NC}"

# Clean contents but keep the directory — rm -rf on the dir itself fails
# on macOS when com.apple.provenance extended attribute is set (sandbox).
if [[ -d "$PLUGINS_DIR" ]]; then
  find "$PLUGINS_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
fi
mkdir -p "$PLUGINS_DIR"
echo -e "${GREEN}  Cleaned plugins/ directory${NC}"
echo ""

# ============================================================================
# Phase 3: Build Plugins from Manifests
# ============================================================================
echo -e "${BLUE}[3/10] Building plugins from manifests...${NC}"
echo ""

CURRENT=0
for manifest in "$MANIFESTS_DIR"/*.json; do
    [[ ! -f "$manifest" ]] && continue

    CURRENT=$((CURRENT + 1))

    # Parse manifest
    PLUGIN_NAME=$(jq -r '.name' "$manifest")
    PLUGIN_VERSION=$(jq -r '.version' "$manifest")
    PLUGIN_DESC=$(jq -r '.description' "$manifest")

    # Detect skills mode (array vs string)
    SKILLS_TYPE=$(jq -r '.skills | type' "$manifest")
    if [[ "$SKILLS_TYPE" == "array" ]]; then
        SKILLS_MODE="array"
    else
        SKILLS_MODE=$(jq -r '.skills // "none"' "$manifest")
    fi

    # Detect agents mode (array vs string)
    AGENTS_TYPE=$(jq -r '.agents | type' "$manifest")
    if [[ "$AGENTS_TYPE" == "array" ]]; then
        AGENTS_MODE="array"
    else
        AGENTS_MODE=$(jq -r '.agents // "none"' "$manifest")
    fi

    HOOKS_MODE=$(jq -r '.hooks // "none"' "$manifest")

    # Skip invalid manifests
    if [[ -z "$PLUGIN_NAME" ]] || [[ "$PLUGIN_NAME" == "null" ]]; then
        echo -e "${YELLOW}  Skipping invalid manifest: $(basename "$manifest")${NC}"
        continue
    fi

    PLUGIN_DIR="$PLUGINS_DIR/$PLUGIN_NAME"
    mkdir -p "$PLUGIN_DIR/.claude-plugin"

    skill_count=0
    agent_count=0
    command_count=0

    # Copy skills
    if [[ "$SKILLS_MODE" == "all" ]]; then
        cp -R "$SRC_DIR/skills" "$PLUGIN_DIR/"
        skill_count=$(find "$PLUGIN_DIR/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
    elif [[ "$SKILLS_MODE" == "array" ]]; then
        mkdir -p "$PLUGIN_DIR/skills"
        while IFS= read -r skill; do
            if [[ -n "$skill" ]] && [[ -d "$SRC_DIR/skills/$skill" ]]; then
                cp -R "$SRC_DIR/skills/$skill" "$PLUGIN_DIR/skills/"
                skill_count=$((skill_count + 1))
            fi
        done < <(jq -r '.skills[]?' "$manifest")
    fi

    # Strip per-skill eval datasets — they are dev/CI-only. The bake-off harness
    # (tests/evals/scripts/run-skill-eval.sh, itself not shipped) reads evals/
    # from src/; the installed plugin ships no harness to consume them. Not
    # shipping them keeps plugins lean AND keeps the packaging security allowlist
    # strict (no .jsonl carve-out needed in test-packaging-leaks.sh). #2555
    if [[ -d "$PLUGIN_DIR/skills" ]]; then
        find "$PLUGIN_DIR/skills" -type d -name evals -prune -exec rm -rf {} +
    fi

    # Generate command wrappers from user-invocable skills, FOR THE CURSOR HOST ONLY.
    # Claude Code surfaces user-invocable skills as /ork:<name> natively (measured
    # 2026-08-29 on 2.1.251: `/ork:glyph hello` expands to <command-name> in the
    # first model request with commands/ removed, identical to with it), so a CC
    # commands/ dir only double-registered every invocable skill (#3541: 141
    # skills listed, /ork:glyph three times in the palette). Cursor's loader
    # still reads its manifest's `commands` path, so the wrappers live under
    # .cursor-plugin/commands/ where CC's default commands/ scan never looks.
    # scripts/probe-command-discovery.sh is the tripwire in the other direction:
    # it fails the day CC stops surfacing skills natively.
    if [[ -d "$PLUGIN_DIR/skills" ]]; then
        for skill_md in "$PLUGIN_DIR/skills"/*/SKILL.md; do
            [[ ! -f "$skill_md" ]] && continue
            if grep -q "^user-invocable: *true" "$skill_md"; then
                skill_name=$(dirname "$skill_md" | xargs basename)
                mkdir -p "$PLUGIN_DIR/.cursor-plugin/commands"
                generate_command_from_skill "$skill_md" "$PLUGIN_DIR/.cursor-plugin/commands/$skill_name.md" "$skill_name"
                command_count=$((command_count + 1))
            fi
        done
    fi

    # Copy agents
    if [[ "$AGENTS_MODE" == "all" ]]; then
        cp -R "$SRC_DIR/agents" "$PLUGIN_DIR/"
        # README / INDEX / CONTRIBUTING under src/agents/ are registry docs,
        # not agents. Drop them from the plugin output so every downstream
        # counter agrees on the number of agents.
        for non_agent in README.md INDEX.md CONTRIBUTING.md; do
            rm -f "$PLUGIN_DIR/agents/$non_agent"
        done
        agent_count=$(find "$PLUGIN_DIR/agents" -mindepth 1 -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
    elif [[ "$AGENTS_MODE" == "array" ]]; then
        mkdir -p "$PLUGIN_DIR/agents"
        while IFS= read -r agent; do
            if [[ -n "$agent" ]] && [[ -f "$SRC_DIR/agents/${agent}.md" ]]; then
                cp "$SRC_DIR/agents/${agent}.md" "$PLUGIN_DIR/agents/"
                agent_count=$((agent_count + 1))
            fi
        done < <(jq -r '.agents[]?' "$manifest")
    fi

    # Copy workflow scripts into the plugin-root workflows/ directory.
    # CC's plugin workflows contract (code.claude.com/docs/en/workflows): a
    # plugin ships workflows/ at its root; each script exports `meta` with
    # name+description and surfaces namespaced as /<plugin>:<meta.name>
    # (e.g. /ork:audit-full-mapreduce). The manifest lists src-relative paths;
    # the copies under skills/<name>/workflows/ remain the source of truth.
    workflow_count=0
    while IFS= read -r wf; do
        if [[ -n "$wf" ]] && [[ -f "$SRC_DIR/$wf" ]]; then
            mkdir -p "$PLUGIN_DIR/workflows"
            cp "$SRC_DIR/$wf" "$PLUGIN_DIR/workflows/"
            workflow_count=$((workflow_count + 1))
        elif [[ -n "$wf" ]]; then
            echo -e "${RED}  ERROR: manifest workflow not found: src/$wf${NC}"
            exit 1
        fi
    done < <(jq -r '.workflows[]?' "$manifest")

    # Copy plugin settings.json (CC 2.1.49 managed defaults)
    SETTINGS_FILE="$SRC_DIR/settings/${PLUGIN_NAME}.settings.json"
    if [[ -f "$SETTINGS_FILE" ]]; then
        cp "$SETTINGS_FILE" "$PLUGIN_DIR/settings.json"
        echo -e "    ${GREEN}Copied settings.json${NC}"
    fi

    # Copy hooks (excluding node_modules)
    if [[ "$HOOKS_MODE" == "all" ]]; then
        rsync -a \
            --exclude='node_modules' \
            --exclude='.claude' \
            --exclude='coverage' \
            --exclude='src' \
            --exclude='logs' \
            --exclude='.instance' \
            --exclude='__tests__' \
            --exclude='*.d.mts' \
            --exclude='*.d.ts' \
            --exclude='*.map' \
            --exclude='TEST_REPORT.md' \
            --exclude='IMPROVEMENT-PLAN.md' \
            --exclude='.gitignore' \
            --exclude='package-lock.json' \
            "$SRC_DIR/hooks/" "$PLUGIN_DIR/hooks/"

        # Inject plugin version into stop-uncommitted-check.mjs
        PLUGIN_VERSION=$(jq -r '.version' "$manifest")
        STOP_HOOK="$PLUGIN_DIR/hooks/bin/stop-uncommitted-check.mjs"
        if [[ -f "$STOP_HOOK" ]] && [[ -n "$PLUGIN_VERSION" ]]; then
            # Cross-platform sed -i (macOS needs '' arg, Linux doesn't)
            if [[ "$(uname)" == "Darwin" ]]; then
                sed -i '' "s/__PLUGIN_VERSION__/${PLUGIN_VERSION}/g" "$STOP_HOOK"
            else
                sed -i "s/__PLUGIN_VERSION__/${PLUGIN_VERSION}/g" "$STOP_HOOK"
            fi
        fi
    fi

    # MCP server build + copy phases removed with the ork-elicit retirement
    # (EPIC C mechanism 11). src/mcp-server existed solely to serve one tool,
    # ork_elicit, which AskUserQuestion replaces natively; its only other tool
    # (docs.ts) was never registered. Both phases were already guarded on the
    # directory existing, so they would have skipped silently forever — dead
    # build machinery that reads as "OrchestKit ships an MCP server".

    # Copy shared resources if they exist
    if [[ -d "$SRC_DIR/shared" ]]; then
        cp -R "$SRC_DIR/shared" "$PLUGIN_DIR/"
    fi

    # Generate plugin.json using jq for consistent formatting.
    # release-please updates the version field in this file via extra-files,
    # so the output format must match jq's default (2-space indent) to avoid
    # build drift on release PRs.
    jq -n \
        --arg name "$PLUGIN_NAME" \
        --arg version "$PLUGIN_VERSION" \
        --arg desc "$PLUGIN_DESC" \
        --argjson has_skills "$([[ -d "$PLUGIN_DIR/skills" ]] && echo true || echo false)" \
        --argjson has_workflows "$([[ -d "$PLUGIN_DIR/workflows" ]] && echo true || echo false)" \
        --argjson deps "$(jq -c '.dependencies // null' "$manifest")" \
        '{
          name: $name,
          version: $version,
          description: $desc,
          author: {
            name: "Yonatan Gross",
            email: "yonaigross@gmail.com",
            url: "https://github.com/yonatangross/orchestkit"
          },
          homepage: "https://github.com/yonatangross/orchestkit",
          repository: "https://github.com/yonatangross/orchestkit",
          license: "MIT",
          keywords: ["ai-development","langgraph","fastapi","react","typescript","python","multi-agent"]
        }
        + if $has_skills then {skills: "./skills/"} else {} end
        # #3326: CC owns `dependencies` (plugin names, or {name, version}); pass
        # it through verbatim. CC installs them transitively at enable time and
        # refuses to enable/disable when unsatisfied, which the retired Phase 5
        # check only approximated by looking for a sibling manifest file.
        + if $deps != null then {dependencies: $deps} else {} end
        + if $has_workflows then {workflows: "./workflows/"} else {} end' \
        > "$PLUGIN_DIR/.claude-plugin/plugin.json"

    # Cursor host manifest: same skills/commands/agents, no Claude hooks.
    # Cursor loads .cursor-plugin/plugin.json (or a root Agent Plugins plugin.json).
    # Claude hooks use ${CLAUDE_PLUGIN_ROOT} and must not be registered here.
    mkdir -p "$PLUGIN_DIR/.cursor-plugin"
    jq --argjson has_agents "$([[ -d "$PLUGIN_DIR/agents" ]] && echo true || echo false)" \
       --argjson has_commands "$([[ -d "$PLUGIN_DIR/.cursor-plugin/commands" ]] && echo true || echo false)" \
      'del(.workflows, .dependencies) + (if $has_agents then {agents: "./agents/"} else {} end)
                       + (if $has_commands then {commands: "./.cursor-plugin/commands/"} else {} end)' \
      "$PLUGIN_DIR/.claude-plugin/plugin.json" \
      > "$PLUGIN_DIR/.cursor-plugin/plugin.json"

    # Generate the Agent Plugins manifest at the PLUGIN ROOT.
    #
    # This is a second, separate file, not an edit to the Claude Code one.
    # agent-plugins.org 1.0.0 puts its manifest at `plugin.json` in the plugin
    # root (spec 4.1 and 5.1: "A plugin MUST include a manifest at plugin.json
    # in the plugin root"), while Claude Code reads
    # `.claude-plugin/plugin.json`. Different paths, so both can be exactly
    # right at once and neither has to compromise for the other.
    #
    # It could NOT have been the same file. The canonical schema at
    # https://agent-plugins.org/schemas/1.0.0/plugin.schema.json is
    # `additionalProperties: false` over ten permitted keys, and the Claude
    # Code manifest above carries three more (skills, commands, workflows).
    # Putting $schema on that file would have named a schema it fails.
    #
    # Derived from the file just written, with an ALLOWLIST rather than a
    # `del(...)` of the three known extras. A denylist fails open: the next
    # field added to the Claude Code manifest would leak in here and silently
    # break conformance. An allowlist means a new field is simply absent until
    # someone decides it belongs, which is the same fail-closed shape the
    # playground CI gate uses.
    jq --arg schema "$AGENT_PLUGINS_SCHEMA" \
        '{"$schema": $schema}
         + with_entries(
             select(.key as $k
                    | ["name","version","description","author",
                       "homepage","repository","license","keywords"]
                    | index($k))
           )' \
        "$PLUGIN_DIR/.claude-plugin/plugin.json" \
        > "$PLUGIN_DIR/plugin.json"

    # #3675: mirror the primary plugin's Agent Plugins manifest to the REPO
    # root as well. Ecosystem scanners that crawl public GitHub look for
    # `plugin.json` at the repository root, not inside plugins/<name>/, so the
    # plugin-root file alone is invisible to them. Kept a byte-identical copy
    # (tests/manifests/test-agent-plugins-manifest.sh asserts it) rather than a
    # hand-edited twin, so it can never drift from the manifest it mirrors.
    if [[ "$PLUGIN_NAME" == "ork" ]]; then
        cp "$PLUGIN_DIR/plugin.json" "$PROJECT_ROOT/plugin.json"
    fi

    TOTAL_SKILLS_COPIED=$((TOTAL_SKILLS_COPIED + skill_count))
    TOTAL_AGENTS_COPIED=$((TOTAL_AGENTS_COPIED + agent_count))
    TOTAL_COMMANDS_GENERATED=$((TOTAL_COMMANDS_GENERATED + command_count))
    PLUGINS_BUILT=$((PLUGINS_BUILT + 1))

    echo -e "${GREEN}  Built $PLUGIN_NAME ($CURRENT/$MANIFEST_COUNT) - $skill_count skills, $agent_count agents, $command_count commands, $workflow_count workflows${NC}"
done

if [[ -x "$SCRIPT_DIR/build-codex-plugin.sh" ]]; then
    echo -e "${BLUE}  Building Codex adapter...${NC}"
    "$SCRIPT_DIR/build-codex-plugin.sh"
else
    echo -e "${RED}  ERROR: build-codex-plugin.sh is missing or not executable${NC}"
    exit 1
fi

echo ""

# ============================================================================
# Phase 4: Validate Built Plugins
# ============================================================================
echo -e "${BLUE}[4/10] Validating built plugins...${NC}"

VALIDATION_ERRORS=0

for plugin_dir in "$PLUGINS_DIR"/*; do
    [[ ! -d "$plugin_dir" ]] && continue

    plugin_name=$(basename "$plugin_dir")

    if [[ -f "$plugin_dir/.codex-plugin/plugin.json" ]]; then
        if ! jq empty "$plugin_dir/.codex-plugin/plugin.json" 2>/dev/null; then
            echo -e "${RED}  $plugin_name: Invalid Codex plugin JSON${NC}"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
        continue
    fi

    if [[ -f "$plugin_dir/.cursor-plugin/plugin.json" ]]; then
        if ! jq empty "$plugin_dir/.cursor-plugin/plugin.json" 2>/dev/null; then
            echo -e "${RED}  $plugin_name: Invalid Cursor plugin JSON${NC}"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
        continue
    fi

    # Check plugin.json exists
    if [[ ! -f "$plugin_dir/.claude-plugin/plugin.json" ]]; then
        echo -e "${RED}  $plugin_name: Missing plugin.json${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi

    # Validate JSON syntax
    if ! jq empty "$plugin_dir/.claude-plugin/plugin.json" 2>/dev/null; then
        echo -e "${RED}  $plugin_name: Invalid JSON${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi

    # Check for symlinks (should be none)
    if find "$plugin_dir" -type l | grep -q .; then
        echo -e "${RED}  $plugin_name: Contains symlinks${NC}"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        continue
    fi
done

if [[ $VALIDATION_ERRORS -gt 0 ]]; then
    echo -e "${RED}Build failed with $VALIDATION_ERRORS validation errors${NC}"
    exit 1
fi

echo -e "${GREEN}  All $PLUGINS_BUILT plugins validated${NC}"
echo ""

# ============================================================================
# Phase 5: Plugin dependencies (retired 2026-08-29, #3326)
# ============================================================================
# The hand-rolled check that looked for a sibling manifest per `dependencies`
# entry is gone: CC owns the field. It is passed through to plugin.json in
# Phase 3, `claude plugin validate` rejects a malformed value, and CC installs
# dependencies transitively at enable time and refuses to enable or disable a
# plugin whose dependencies are unsatisfied. A local check could only answer
# for plugins built in this repo, which is not where a dependency lives.
echo -e "${BLUE}[5/10] Plugin dependencies: owned by CC (passed through to plugin.json)${NC}"
echo ""

# ============================================================================
# Phase 6: Generate Passive Indexes (Tier 1 + Tier 2)
# ============================================================================
echo -e "${BLUE}[6/10] Generating passive indexes...${NC}"

if [[ -f "$SCRIPT_DIR/generate-indexes.js" ]]; then
    node "$SCRIPT_DIR/generate-indexes.js"
else
    echo -e "${YELLOW}  generate-indexes.js not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 7: Generate Docs Site Data
# ============================================================================
echo -e "${BLUE}[7/10] Generating docs site data...${NC}"

if [[ -f "$SCRIPT_DIR/generate-docs-data.js" ]]; then
    node "$SCRIPT_DIR/generate-docs-data.js" 2>/dev/null || echo -e "${YELLOW}  generate-docs-data.js failed, skipping${NC}"
else
    echo -e "${YELLOW}  generate-docs-data.js not found, skipping${NC}"
fi

# Lightweight docs search index (keeps NLWeb /ask + MCP searchDocs off the heavy
# Fumadocs source so the /ask function cold-starts sub-second).
if [[ -f "$SCRIPT_DIR/gen-docs-search-index.js" ]]; then
    node "$SCRIPT_DIR/gen-docs-search-index.js" || echo -e "${YELLOW}  gen-docs-search-index.js failed${NC}"
fi

# Lab gallery + CC-adoption board data (docs/site/lib/generated/lab-data.ts and
# cc-adoption-data.ts). ci.yml's "Check for uncommitted build changes" step
# diffs docs/site/lib/generated/, but nothing in this build regenerated
# cc-adoption-data.ts, so that gate was structurally blind to it and the
# published board froze at an old "latest known upstream" while
# shared/cc-support.json moved on. Deliberately NOT failure-swallowed: the
# generator is a pure function of lab-manifest.json + shared/cc-*.json, so a
# non-zero exit here is a real, actionable problem (a pruned lab source).
LAB_DATA_GEN="$PROJECT_ROOT/docs/site/scripts/generate-lab-data.mjs"
if [[ -f "$LAB_DATA_GEN" ]]; then
    node "$LAB_DATA_GEN" || {
        echo -e "${RED}  generate-lab-data.mjs failed${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}  generate-lab-data.mjs not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 7.5: Verify Vendor Upstream References
# ============================================================================
echo -e "${BLUE}[7.5/10] Checking vendor upstream references...${NC}"

if [[ -f "$SCRIPT_DIR/sync-vercel-skills.sh" ]]; then
    # HARD TIME BOUND. This check is advisory (both outcome branches below are
    # non-fatal), but unbounded it could wedge the WHOLE build indefinitely:
    # observed repeatedly in worktrees, including one build left at 6h28m
    # elapsed with 0.22s of CPU, asleep in this step with no child processes
    # and no network activity. `--check` only stats 37 local files, so it has
    # no legitimate reason to exceed a second; longer means the hang, not work.
    #
    # macOS ships no `timeout`, hence the portable background+poll form.
    # Killing the child is safe: the original call sat inside an `if` condition
    # precisely so a non-zero exit takes the else branch and the build proceeds
    # through steps 8-10 (`set -e` does not fire inside an `if` condition).
    _sync_deadline=30
    bash "$SCRIPT_DIR/sync-vercel-skills.sh" --check >/dev/null 2>&1 &
    _sync_pid=$!
    _sync_waited=0
    # silent: infrastructure-resilience `kill -0` is a liveness probe; its stderr on a reaped pid is not an error
    while kill -0 "$_sync_pid" 2>/dev/null && [[ $_sync_waited -lt $_sync_deadline ]]; do
        sleep 1
        _sync_waited=$((_sync_waited + 1))
    done
    # silent: infrastructure-resilience same liveness probe, deciding timed-out vs finished
    if kill -0 "$_sync_pid" 2>/dev/null; then
        # silent: infrastructure-resilience killing + reaping a hung advisory child; non-zero here is the expected path
        kill -KILL "$_sync_pid" 2>/dev/null || true
        # silent: infrastructure-resilience `wait` on a SIGKILLed child always returns non-zero
        wait "$_sync_pid" 2>/dev/null || true
        echo -e "${YELLOW}  Vendor refs: check exceeded ${_sync_deadline}s and was killed (advisory, build continues)${NC}"
    elif wait "$_sync_pid"; then
        echo -e "${GREEN}  Vendor refs: all present${NC}"
    else
        echo -e "${RED}  Vendor refs: stale or missing — run: bash scripts/sync-vercel-skills.sh${NC}"
        # Non-fatal: warn but don't fail the build (network may be unavailable)
    fi
else
    echo -e "${YELLOW}  sync-vercel-skills.sh not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 8: Regenerate Fumadocs reference pages
# ============================================================================
echo -e "${BLUE}[8/10] Regenerating docs reference pages...${NC}"

if [[ -x "$SCRIPT_DIR/build-docs.sh" ]]; then
    bash "$SCRIPT_DIR/build-docs.sh" 2>/dev/null || echo -e "${YELLOW}  build-docs.sh failed, skipping${NC}"
else
    echo -e "${YELLOW}  build-docs.sh not found or not executable, skipping${NC}"
fi

# Generate changelog timeline data
if [[ -f "$SCRIPT_DIR/generate-changelog-data.js" ]]; then
    node "$SCRIPT_DIR/generate-changelog-data.js" 2>/dev/null || echo -e "${YELLOW}  generate-changelog-data.js failed, skipping${NC}"
else
    echo -e "${YELLOW}  generate-changelog-data.js not found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 9: Sync marketplace.json versions from manifests
# ============================================================================
echo -e "${BLUE}[9/10] Syncing marketplace.json...${NC}"

MARKETPLACE_FILE="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE_FILE" ]]; then
  # Use the top-level project version for ALL plugin entries
  PROJECT_VERSION=$(jq -r '.version' "$MARKETPLACE_FILE")
  VER_SYNC_COUNT=0

  for manifest in "$MANIFESTS_DIR"/*.json; do
    PLUGIN_NAME=$(jq -r '.name' "$manifest")

    # Set version to project version — but NEVER on a pinned channel entry.
    # An entry whose source.ref names anything other than "main" is pinned to a
    # released tag on purpose (#3340), and its version must keep agreeing with
    # that tag, not with the project version. This loop was the SECOND writer
    # breaking the release branch in CI: #3342 fixed stamp-counts, then this
    # by-name sync re-stamped the pinned `ork` entry to 10.0.0-alpha during the
    # fresh build, and test-alpha-channel failed the pin agreement again.
    # The marketplace file's existence is guarded above; jq errors stay loud.
    CURRENT_VERSION=$(jq -r --arg name "$PLUGIN_NAME" \
      '.plugins[] | select(.name == $name)
       | select((.source | type) != "object" or (.source.ref // "main") == "main")
       | .version' "$MARKETPLACE_FILE")
    if [[ -n "$CURRENT_VERSION" && "$CURRENT_VERSION" != "$PROJECT_VERSION" ]]; then
      jq --arg name "$PLUGIN_NAME" --arg ver "$PROJECT_VERSION" \
        '(.plugins[] | select(.name == $name)
          | select((.source | type) != "object" or (.source.ref // "main") == "main")
         ).version = $ver' \
        "$MARKETPLACE_FILE" > "${MARKETPLACE_FILE}.tmp" && mv "${MARKETPLACE_FILE}.tmp" "$MARKETPLACE_FILE"
      VER_SYNC_COUNT=$((VER_SYNC_COUNT + 1))
    fi
  done

  # NOTE: Dependencies are tracked in manifests/*.json for internal use only.
  # They must NOT be written to marketplace.json — Claude Code's schema validator
  # rejects unrecognized keys like "deps".

  echo -e "${GREEN}  Versions: synced $VER_SYNC_COUNT to $PROJECT_VERSION${NC}"
else
  echo -e "${YELLOW}  No marketplace.json found, skipping${NC}"
fi

echo ""

# ============================================================================
# Phase 10: Summary
# ============================================================================
echo ""
echo "Stamping counts and version markers…"
bash "$(dirname "$0")/stamp-counts.sh"
node "$(dirname "$0")/stamp-whats-new.mjs"
echo ""

echo -e "${BLUE}[10/10] Build Summary${NC}"
echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}                    BUILD COMPLETE${NC}"
echo -e "${CYAN}============================================================${NC}"
echo -e "  Plugins built:          ${GREEN}$PLUGINS_BUILT${NC}"
echo -e "  Total skills copied:    ${GREEN}$TOTAL_SKILLS_COPIED${NC}"
echo -e "  Total agents copied:    ${GREEN}$TOTAL_AGENTS_COPIED${NC}"
echo -e "  Total commands generated: ${GREEN}$TOTAL_COMMANDS_GENERATED${NC}"
echo -e "  Output directory:       ${GREEN}$PLUGINS_DIR${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""
