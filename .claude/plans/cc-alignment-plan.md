# CC 2.1.16 Alignment Plan

## Executive Summary

OrchestKit has structural misalignments with Claude Code's plugin system that prevent skills, agents, and commands from working correctly. This plan addresses these gaps with concrete fixes and comprehensive tests.

---

## Findings Summary

| Issue | Severity | Status |
|-------|----------|--------|
| Wrong plugin.json syntax `{ "directory": }` | CRITICAL | To Fix |
| Commands/Skills namespace collision (21 duplicates) | HIGH | To Fix |
| Commands directory is legacy (use skills) | MEDIUM | To Fix |
| Agent auto-dispatch not implemented | INFO | By Design |
| Skill auto-suggest is advisory only | INFO | By Design |

---

## Phase 1: Plugin.json Schema Fix

### Current (WRONG)
```json
{
  "commands": { "directory": "commands" },
  "agents": { "directory": "agents" },
  "skills": { "directory": "skills" }
}
```

### Target (CORRECT per CC docs)
```json
{
  "agents": "./agents/",
  "skills": "./skills/"
}
```

**Note:** Commands field removed entirely - skills with `user-invocable: true` serve this purpose.

### Test: `tests/plugins/test-plugin-json-schema.sh`
```bash
#!/usr/bin/env bash
# Validate plugin.json against CC 2.1.16 schema requirements

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"

FAILED=0

echo "Testing plugin.json CC 2.1.16 compliance..."

# Test 1: Skills field is string or array, not object
skills_type=$(jq -r 'type_of(.skills)' "$PLUGIN_JSON" 2>/dev/null || echo "null")
if [[ "$skills_type" == "object" ]]; then
    echo "FAIL: skills must be string or array, got object"
    echo "      Expected: \"./skills/\" or [\"./skills/\"]"
    echo "      Got: $(jq '.skills' "$PLUGIN_JSON")"
    ((FAILED++))
else
    echo "PASS: skills field type is valid ($skills_type)"
fi

# Test 2: Agents field is string or array, not object
agents_type=$(jq -r 'type_of(.agents)' "$PLUGIN_JSON" 2>/dev/null || echo "null")
if [[ "$agents_type" == "object" ]]; then
    echo "FAIL: agents must be string or array, got object"
    ((FAILED++))
else
    echo "PASS: agents field type is valid ($agents_type)"
fi

# Test 3: No commands field (deprecated, use skills)
if jq -e '.commands' "$PLUGIN_JSON" >/dev/null 2>&1; then
    echo "FAIL: commands field should be removed (use skills with user-invocable: true)"
    ((FAILED++))
else
    echo "PASS: commands field correctly absent"
fi

# Test 4: Required fields present
for field in name version description; do
    if ! jq -e ".$field" "$PLUGIN_JSON" >/dev/null 2>&1; then
        echo "FAIL: Missing required field: $field"
        ((FAILED++))
    else
        echo "PASS: Required field $field present"
    fi
done

# Test 5: Paths are relative (start with ./)
for path_field in agents skills; do
    value=$(jq -r ".$path_field // empty" "$PLUGIN_JSON" 2>/dev/null)
    if [[ -n "$value" ]] && [[ ! "$value" =~ ^\.\/ ]]; then
        echo "FAIL: $path_field path should start with ./ (got: $value)"
        ((FAILED++))
    fi
done

exit $FAILED
```

---

## Phase 2: Remove Commands Directory

### Action
```bash
# Delete commands directory (skills supersede it)
rm -rf commands/

# Update CLAUDE.md to remove commands references
# Update counts: 162 skills (21 user-invocable, 141 internal), NOT "21 commands"
```

### Test: `tests/plugins/test-no-commands-directory.sh`
```bash
#!/usr/bin/env bash
# Verify commands directory doesn't exist (skills are used instead)

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

if [[ -d "$PROJECT_ROOT/commands" ]]; then
    echo "FAIL: commands/ directory should not exist"
    echo "      Skills with user-invocable: true serve this purpose"
    echo "      Action: rm -rf commands/"
    exit 1
fi

echo "PASS: commands/ directory correctly absent (using skills)"
exit 0
```

---

## Phase 3: Skill Registration Tests

### Test: `tests/plugins/test-skill-discovery.sh`
```bash
#!/usr/bin/env bash
# Test that skills are discoverable by CC's auto-discovery mechanism

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/skills"

FAILED=0
USER_INVOCABLE=0
INTERNAL=0

echo "Testing skill auto-discovery requirements..."

# Test 1: Skills directory exists at root
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo "FAIL: skills/ directory not found at project root"
    exit 1
fi
echo "PASS: skills/ directory exists"

# Test 2: Each skill has SKILL.md
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    if [[ ! -f "$skill_dir/SKILL.md" ]]; then
        echo "FAIL: $skill_name missing SKILL.md"
        ((FAILED++))
    fi
done

# Test 3: Count user-invocable vs internal
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_file="$skill_dir/SKILL.md"
    if grep -q "user-invocable: true" "$skill_file" 2>/dev/null; then
        ((USER_INVOCABLE++))
    else
        ((INTERNAL++))
    fi
done

echo "Found: $USER_INVOCABLE user-invocable, $INTERNAL internal skills"

# Test 4: User-invocable skills have required trigger phrases
for skill_dir in "$SKILLS_DIR"/*/; do
    skill_file="$skill_dir/SKILL.md"
    skill_name=$(basename "$skill_dir")

    if grep -q "user-invocable: true" "$skill_file" 2>/dev/null; then
        desc=$(sed -n '/^---$/,/^---$/p' "$skill_file" | grep "^description:" | head -1)
        if [[ ! "$desc" =~ (Use\ when|Use\ for|Use\ this) ]]; then
            echo "WARN: $skill_name (user-invocable) missing trigger phrase in description"
        fi
    fi
done

if [[ $FAILED -gt 0 ]]; then
    echo "FAILED: $FAILED skills have issues"
    exit 1
fi

echo "PASS: All skills properly structured for CC discovery"
exit 0
```

---

## Phase 4: Agent Registration Tests

### Test: `tests/plugins/test-agent-discovery.sh`
```bash
#!/usr/bin/env bash
# Test that agents are discoverable by CC's auto-discovery mechanism

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
AGENTS_DIR="$PROJECT_ROOT/agents"

FAILED=0

echo "Testing agent auto-discovery requirements..."

# Test 1: Agents directory exists at root
if [[ ! -d "$AGENTS_DIR" ]]; then
    echo "FAIL: agents/ directory not found at project root"
    exit 1
fi
echo "PASS: agents/ directory exists"

# Test 2: Each agent file has required frontmatter
for agent_file in "$AGENTS_DIR"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Check for name field
    if ! grep -q "^name:" "$agent_file" 2>/dev/null; then
        echo "FAIL: $agent_name missing 'name' in frontmatter"
        ((FAILED++))
        continue
    fi

    # Check for description field
    if ! grep -q "^description:" "$agent_file" 2>/dev/null; then
        echo "FAIL: $agent_name missing 'description' in frontmatter"
        ((FAILED++))
        continue
    fi

    # Check description has activation keywords
    desc=$(sed -n '/^---$/,/^---$/p' "$agent_file" | grep "^description:" | head -1)
    if [[ ! "$desc" =~ (Activates\ for|activates\ for) ]]; then
        echo "WARN: $agent_name description missing 'Activates for' keywords"
    fi

    echo "PASS: $agent_name has valid frontmatter"
done

if [[ $FAILED -gt 0 ]]; then
    echo "FAILED: $FAILED agents have issues"
    exit 1
fi

echo "PASS: All agents properly structured for CC discovery"
exit 0
```

---

## Phase 5: Integration Tests - Spawning & Triggering

### Test: `tests/integration/test-skill-invocation-e2e.sh`
```bash
#!/usr/bin/env bash
# E2E test for skill invocation via Skill tool

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

echo "Testing skill invocation simulation..."

# Test 1: Simulate CC loading skills at startup
echo "Simulating skill discovery..."
skills_count=0
user_invocable_names=()

for skill_dir in "$PROJECT_ROOT/skills"/*/; do
    skill_file="$skill_dir/SKILL.md"
    if [[ -f "$skill_file" ]]; then
        ((skills_count++))

        # Extract name
        name=$(awk '/^---$/,/^---$/ { if (/^name:/) { sub(/^name: */, ""); gsub(/["'"'"']/, ""); print; exit } }' "$skill_file")

        # Check if user-invocable
        if grep -q "user-invocable: true" "$skill_file" 2>/dev/null; then
            user_invocable_names+=("$name")
        fi
    fi
done

echo "Discovered $skills_count skills"
echo "User-invocable: ${#user_invocable_names[@]}"
echo "Available as: /ork:${user_invocable_names[0]}, /ork:${user_invocable_names[1]}, ..."

# Test 2: Verify skill content is loadable
for skill_name in commit verify doctor configure; do
    skill_file="$PROJECT_ROOT/skills/$skill_name/SKILL.md"
    if [[ ! -f "$skill_file" ]]; then
        echo "FAIL: User-invocable skill '$skill_name' not found"
        exit 1
    fi

    # Check it has meaningful content (>100 chars after frontmatter)
    content_length=$(sed '1,/^---$/d; 1,/^---$/d' "$skill_file" | wc -c | tr -d ' ')
    if [[ $content_length -lt 100 ]]; then
        echo "FAIL: $skill_name has insufficient content ($content_length chars)"
        exit 1
    fi
    echo "PASS: $skill_name loadable ($content_length chars)"
done

echo "PASS: Skill invocation simulation complete"
```

### Test: `tests/integration/test-agent-spawn-e2e.sh`
```bash
#!/usr/bin/env bash
# E2E test for agent spawning via Task tool

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

echo "Testing agent spawn simulation..."

# Test 1: Verify agents exist and are loadable
REQUIRED_AGENTS=(
    "backend-system-architect"
    "frontend-ui-developer"
    "test-generator"
    "security-auditor"
    "debug-investigator"
)

for agent_name in "${REQUIRED_AGENTS[@]}"; do
    agent_file="$PROJECT_ROOT/agents/$agent_name.md"

    if [[ ! -f "$agent_file" ]]; then
        echo "FAIL: Required agent '$agent_name' not found"
        exit 1
    fi

    # Extract and validate frontmatter
    name=$(awk '/^---$/,/^---$/ { if (/^name:/) { sub(/^name: */, ""); gsub(/["'"'"']/, ""); print; exit } }' "$agent_file")
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); gsub(/^["'"'"']|["'"'"']$/, ""); print; exit } }' "$agent_file")

    if [[ -z "$name" ]]; then
        echo "FAIL: $agent_name missing name in frontmatter"
        exit 1
    fi

    if [[ -z "$desc" ]]; then
        echo "FAIL: $agent_name missing description in frontmatter"
        exit 1
    fi

    # Check for tools specification
    if ! grep -q "^tools:" "$agent_file" 2>/dev/null; then
        echo "WARN: $agent_name missing tools specification"
    fi

    echo "PASS: $agent_name validated (name: $name)"
done

# Test 2: Verify agent-skill relationships
echo "Checking agent skill references..."
for agent_file in "$PROJECT_ROOT/agents"/*.md; do
    agent_name=$(basename "$agent_file" .md)

    # Extract skills from frontmatter
    skills=$(awk '/^---$/,/^---$/ { if (/^skills:$/,/^[a-z]/) { if (/^  - /) { sub(/^  - /, ""); print } } }' "$agent_file")

    while IFS= read -r skill; do
        [[ -z "$skill" ]] && continue
        if [[ ! -d "$PROJECT_ROOT/skills/$skill" ]]; then
            echo "WARN: $agent_name references non-existent skill: $skill"
        fi
    done <<< "$skills"
done

echo "PASS: Agent spawn simulation complete"
```

---

## Phase 6: Hook Integration Tests

### Test: `tests/integration/test-skill-auto-suggest-triggers.sh`
```bash
#!/usr/bin/env bash
# Test that skill-auto-suggest hook properly suggests skills

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
HOOK="$PROJECT_ROOT/hooks/prompt/skill-auto-suggest.sh"

echo "Testing skill auto-suggest triggering..."

# Test prompts and expected skills
declare -A TEST_CASES=(
    ["Help me design a REST API"]="api-design-framework"
    ["Create a database schema"]="database-schema-designer"
    ["Implement JWT authentication"]="auth-patterns"
    ["Write pytest unit tests"]="pytest-advanced"
    ["Build a FastAPI endpoint"]="fastapi-advanced"
    ["Fix OWASP vulnerabilities"]="owasp-top-10"
)

FAILED=0

for prompt in "${!TEST_CASES[@]}"; do
    expected_skill="${TEST_CASES[$prompt]}"
    input="{\"prompt\":\"$prompt\"}"

    output=$(echo "$input" | bash "$HOOK" 2>/dev/null) || true

    if ! echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
        echo "FAIL: No suggestion for prompt: $prompt"
        ((FAILED++))
        continue
    fi

    context=$(echo "$output" | jq -r '.hookSpecificOutput.additionalContext')

    if [[ "$context" == *"$expected_skill"* ]]; then
        echo "PASS: '$prompt' -> $expected_skill"
    else
        echo "FAIL: '$prompt' expected $expected_skill"
        echo "      Got: $(echo "$context" | head -c 100)..."
        ((FAILED++))
    fi
done

if [[ $FAILED -gt 0 ]]; then
    echo "FAILED: $FAILED test cases"
    exit 1
fi

echo "PASS: All skill suggestions working"
```

---

## Phase 7: Full CC Discovery Simulation

### Test: `tests/integration/test-cc-discovery-simulation.sh`
```bash
#!/usr/bin/env bash
# Simulate CC's complete discovery process

set -euo pipefail

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PLUGIN_JSON="$PROJECT_ROOT/.claude-plugin/plugin.json"

echo "=============================================="
echo "CC 2.1.16 Discovery Simulation"
echo "=============================================="

# Step 1: Read plugin.json
echo ""
echo "Step 1: Reading plugin.json..."
if [[ ! -f "$PLUGIN_JSON" ]]; then
    echo "FAIL: plugin.json not found"
    exit 1
fi

name=$(jq -r '.name' "$PLUGIN_JSON")
version=$(jq -r '.version' "$PLUGIN_JSON")
echo "Plugin: $name v$version"

# Step 2: Discover skills directory
echo ""
echo "Step 2: Discovering skills..."
skills_path=$(jq -r '.skills // "./skills/"' "$PLUGIN_JSON")
# Handle both string and object formats
if [[ "$skills_path" == *"directory"* ]]; then
    skills_path=$(jq -r '.skills.directory // "skills"' "$PLUGIN_JSON")
    skills_path="./$skills_path/"
fi

skills_dir="$PROJECT_ROOT/${skills_path#./}"
skills_dir="${skills_dir%/}"

if [[ ! -d "$skills_dir" ]]; then
    echo "FAIL: Skills directory not found: $skills_dir"
    exit 1
fi

skill_count=$(find "$skills_dir" -maxdepth 2 -name "SKILL.md" | wc -l | tr -d ' ')
echo "Found $skill_count skills in $skills_dir"

# Step 3: Discover agents directory
echo ""
echo "Step 3: Discovering agents..."
agents_path=$(jq -r '.agents // "./agents/"' "$PLUGIN_JSON")
if [[ "$agents_path" == *"directory"* ]]; then
    agents_path=$(jq -r '.agents.directory // "agents"' "$PLUGIN_JSON")
    agents_path="./$agents_path/"
fi

agents_dir="$PROJECT_ROOT/${agents_path#./}"
agents_dir="${agents_dir%/}"

if [[ ! -d "$agents_dir" ]]; then
    echo "FAIL: Agents directory not found: $agents_dir"
    exit 1
fi

agent_count=$(find "$agents_dir" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
echo "Found $agent_count agents in $agents_dir"

# Step 4: Build skill index (simulating CC startup)
echo ""
echo "Step 4: Building skill index..."
user_invocable=()
internal=()

for skill_file in "$skills_dir"/*/SKILL.md; do
    skill_name=$(basename "$(dirname "$skill_file")")

    # Extract name and description from frontmatter
    name=$(awk '/^---$/,/^---$/ { if (/^name:/) { sub(/^name: */, ""); gsub(/["'"'"']/, ""); print; exit } }' "$skill_file")
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); print; exit } }' "$skill_file" | head -c 100)

    if grep -q "user-invocable: true" "$skill_file" 2>/dev/null; then
        user_invocable+=("$name")
    else
        internal+=("$name")
    fi
done

echo "User-invocable skills (${#user_invocable[@]}):"
printf '  - /ork:%s\n' "${user_invocable[@]:0:5}"
[[ ${#user_invocable[@]} -gt 5 ]] && echo "  ... and $((${#user_invocable[@]} - 5)) more"

echo ""
echo "Internal skills: ${#internal[@]}"

# Step 5: Build agent index
echo ""
echo "Step 5: Building agent index..."
for agent_file in "$agents_dir"/*.md; do
    agent_name=$(basename "$agent_file" .md)
    desc=$(awk '/^---$/,/^---$/ { if (/^description:/) { sub(/^description: */, ""); gsub(/^["'"'"']|["'"'"']$/, ""); print; exit } }' "$agent_file" | head -c 80)
    echo "  - $agent_name: $desc..."
done | head -10

# Summary
echo ""
echo "=============================================="
echo "Discovery Summary"
echo "=============================================="
echo "Skills: $skill_count (${#user_invocable[@]} user-invocable, ${#internal[@]} internal)"
echo "Agents: $agent_count"
echo ""
echo "PASS: CC discovery simulation complete"
```

---

## Implementation Checklist

### Immediate Actions

- [ ] **Fix plugin.json syntax**
  ```bash
  # Update .claude-plugin/plugin.json
  # Change: "skills": { "directory": "skills" }
  # To: "skills": "./skills/"
  ```

- [ ] **Delete commands directory**
  ```bash
  rm -rf commands/
  ```

- [ ] **Update plugin.json**
  - Remove `commands` field
  - Change `agents` and `skills` to string paths

- [ ] **Add new tests**
  - `tests/plugins/test-plugin-json-schema.sh`
  - `tests/plugins/test-no-commands-directory.sh`
  - `tests/plugins/test-skill-discovery.sh`
  - `tests/plugins/test-agent-discovery.sh`
  - `tests/integration/test-cc-discovery-simulation.sh`

### Documentation Updates

- [ ] Update CLAUDE.md
  - Remove "21 commands" - say "162 skills (21 user-invocable)"
  - Clarify that agent "Activates for" is advisory, not auto-dispatch
  - Remove claims about automatic progressive loading

- [ ] Update README.md
  - Fix installation instructions
  - Remove commands directory references

---

## Verification Commands

```bash
# Run all CC alignment tests
./tests/plugins/test-plugin-json-schema.sh
./tests/plugins/test-no-commands-directory.sh
./tests/plugins/test-skill-discovery.sh
./tests/plugins/test-agent-discovery.sh
./tests/integration/test-cc-discovery-simulation.sh

# Full test suite
./tests/run-all-tests.sh
```

---

## Sources

- [Plugins Reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase)
- [Anthropic Agent Skills Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

---

**Created**: 2026-01-22
**CC Version Target**: 2.1.16
**Status**: Plan Ready for Implementation
