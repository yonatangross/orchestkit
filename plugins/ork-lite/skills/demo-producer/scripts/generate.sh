#!/usr/bin/env bash
# Universal Demo Generator
# Creates demo scripts and VHS tapes for any content type
#
# Usage:
#   ./generate.sh skill explore
#   ./generate.sh agent debug-investigator
#   ./generate.sh plugin ork-core
#   ./generate.sh tutorial "Building a REST API"
#   ./generate.sh cli "npm create vite"
#   ./generate.sh code src/api/auth.ts

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_DIR="${PROJECT_ROOT}/orchestkit-demos"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Parse arguments
CONTENT_TYPE="${1:-}"
CONTENT_SOURCE="${2:-}"
STYLE="${3:-standard}"
FORMAT="${4:-horizontal,vertical}"
CINEMATIC_MODE=false
AGENTS_COUNT=6

# Parse flags
for arg in "$@"; do
    case $arg in
        --cinematic)
            CINEMATIC_MODE=true
            STYLE="cinematic"
            ;;
        --agents=*)
            AGENTS_COUNT="${arg#*=}"
            ;;
    esac
done

if [[ -z "$CONTENT_TYPE" ]] || [[ -z "$CONTENT_SOURCE" ]]; then
    echo "Usage: $0 <type> <source> [style] [format] [--cinematic] [--agents=N]"
    echo ""
    echo "Types:"
    echo "  skill    - OrchestKit skill (source: skill name)"
    echo "  agent    - AI agent (source: agent name)"
    echo "  plugin   - Plugin (source: plugin name)"
    echo "  tutorial - Custom tutorial (source: title)"
    echo "  cli      - CLI tool demo (source: command)"
    echo "  code     - Code walkthrough (source: file path)"
    echo ""
    echo "Styles: quick, standard, tutorial, cinematic"
    echo "Formats: horizontal, vertical, square (comma-separated)"
    echo ""
    echo "Flags:"
    echo "  --cinematic  Enable cinematic mode with parallel agents"
    echo "  --agents=N   Number of agents to show (default: 6)"
    exit 1
fi

# Normalize name for file paths
normalize_name() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-'
}

# Extract skill metadata
extract_skill_metadata() {
    local skill_name="$1"
    local skill_path="${PROJECT_ROOT}/skills/${skill_name}/SKILL.md"

    if [[ ! -f "$skill_path" ]]; then
        log_error "Skill not found: $skill_path"
        exit 1
    fi

    # Extract frontmatter fields
    DEMO_NAME=$(grep "^name:" "$skill_path" | head -1 | cut -d: -f2- | xargs)
    DEMO_DESCRIPTION=$(grep "^description:" "$skill_path" | head -1 | cut -d: -f2- | xargs)
    DEMO_TAGS=$(grep "^tags:" "$skill_path" | head -1 | sed 's/tags: \[//' | sed 's/\]//' | tr -d '"' | xargs)

    # Extract related skills if any
    RELATED_SKILLS=""
    if grep -q "related-skills:" "$skill_path"; then
        RELATED_SKILLS=$(grep "related-skills:" "$skill_path" | head -1 | cut -d: -f2- | xargs)
    fi

    # Extract phases from ## headers (skip first few standard headers)
    PHASES=$(grep "^## " "$skill_path" | grep -v "Quick Start\|Overview\|When to Use\|Installation" | sed 's/## //' | head -5)

    log_success "Extracted skill metadata: $DEMO_NAME"
}

# Extract agent metadata
extract_agent_metadata() {
    local agent_name="$1"
    local agent_path="${PROJECT_ROOT}/agents/${agent_name}.md"

    if [[ ! -f "$agent_path" ]]; then
        log_error "Agent not found: $agent_path"
        exit 1
    fi

    DEMO_NAME=$(grep "^name:" "$agent_path" | head -1 | cut -d: -f2- | xargs)
    DEMO_DESCRIPTION=$(grep "^description:" "$agent_path" | head -1 | cut -d: -f2- | xargs | cut -c1-100)

    # Extract tools
    AGENT_TOOLS=$(grep -A 20 "^tools:" "$agent_path" | grep "^  - " | sed 's/  - //' | head -8 | tr '\n' ', ' | sed 's/,$//')

    # Extract skills
    AGENT_SKILLS=$(grep -A 20 "^skills:" "$agent_path" | grep "^  - " | sed 's/  - //' | head -5 | tr '\n' ', ' | sed 's/,$//')

    log_success "Extracted agent metadata: $DEMO_NAME"
}

# Extract plugin metadata
extract_plugin_metadata() {
    local plugin_name="$1"
    local plugin_path="${PROJECT_ROOT}/plugins/${plugin_name}/.claude-plugin/plugin.json"

    if [[ ! -f "$plugin_path" ]]; then
        log_error "Plugin not found: $plugin_path"
        exit 1
    fi

    DEMO_NAME=$(jq -r '.name // "unknown"' "$plugin_path")
    DEMO_DESCRIPTION=$(jq -r '.description // "No description"' "$plugin_path")
    PLUGIN_VERSION=$(jq -r '.version // "1.0.0"' "$plugin_path")
    SKILLS_COUNT=$(jq '.skills // [] | length' "$plugin_path")
    AGENTS_COUNT=$(jq '.agents // [] | length' "$plugin_path")
    HOOKS_COUNT=$(jq '.hooks // [] | length' "$plugin_path")

    log_success "Extracted plugin metadata: $DEMO_NAME v$PLUGIN_VERSION"
}

# ==================== CINEMATIC MODE FUNCTIONS ====================

# Generate parallel agent spawning section
generate_parallel_agent_section() {
    local agents="$1"
    local output_script="$2"

    IFS=',' read -ra AGENT_ARRAY <<< "$agents"
    local agent_count=${#AGENT_ARRAY[@]}

    cat >> "$output_script" << 'PARALLEL_HEADER'
    echo
    echo -e "${YELLOW}⚡${RESET} Spawning parallel agents via Task tool..."
    sleep 0.3
PARALLEL_HEADER

    # Create tasks for each agent
    local task_ids=""
    local i=1
    for agent in "${AGENT_ARRAY[@]}"; do
        task_ids="$task_ids#$i "
        cat >> "$output_script" << TASK_CREATE
    echo -e "\${CYAN}◆\${RESET} TaskCreate: Created task #${i} \"${agent}\""
    sleep 0.15
TASK_CREATE
        ((i++))
    done

    cat >> "$output_script" << PARALLEL_EXEC
    echo
    echo -e "\${CYAN}◆\${RESET} TaskUpdate: Tasks ${task_ids}→ in_progress (PARALLEL)"
    sleep 0.4
    echo
PARALLEL_EXEC

    # Show interleaved progress
    cat >> "$output_script" << 'PROGRESS_HEADER'
    # Interleaved progress display
    progress_values=()
PROGRESS_HEADER

    for ((j=0; j<agent_count; j++)); do
        cat >> "$output_script" << INIT_PROGRESS
    progress_values+=("0")
INIT_PROGRESS
    done

    cat >> "$output_script" << 'PROGRESS_LOOP'
    for step in 1 2 3 4 5; do
        line=""
        for idx in "${!progress_values[@]}"; do
            val=${progress_values[$idx]}
            new_val=$((val + RANDOM % 25 + 10))
            if [ $new_val -gt 100 ]; then new_val=100; fi
            progress_values[$idx]=$new_val
            line="$line #$((idx+1)): ${new_val}% |"
        done
        printf "\r   ${DIM}[Progress: ${line%|}]${RESET}"
        sleep 0.3
    done
    echo
    echo
PROGRESS_LOOP

    # Complete tasks
    i=1
    for agent in "${AGENT_ARRAY[@]}"; do
        cat >> "$output_script" << TASK_COMPLETE
    echo -e "\${GREEN}✓\${RESET} Task #${i} (${agent}) completed"
    sleep 0.2
TASK_COMPLETE
        ((i++))
    done

    cat >> "$output_script" << PARALLEL_FOOTER
    echo
    echo -e "\${GREEN}◆\${RESET} All ${agent_count} agents completed in parallel!"
    sleep 0.3
PARALLEL_FOOTER
}

# Generate task dependency section
generate_task_dependency_section() {
    local output_script="$1"

    cat >> "$output_script" << 'DEPS_SECTION'
    echo
    echo -e "${CYAN}◆${RESET} Setting up task dependencies..."
    sleep 0.3

    # Independent tasks
    echo -e "${CYAN}◆${RESET} TaskCreate: #1 \"Analyze code\" (no blockers)"
    sleep 0.15
    echo -e "${CYAN}◆${RESET} TaskCreate: #2 \"Security scan\" (no blockers)"
    sleep 0.15
    echo -e "${CYAN}◆${RESET} TaskCreate: #3 \"Run tests\" (no blockers)"
    sleep 0.15

    # Dependent task
    echo -e "${CYAN}◆${RESET} TaskCreate: #4 \"Generate report\" (blockedBy: #1, #2, #3)"
    sleep 0.3
    echo

    # Execute independent tasks
    echo -e "${CYAN}◆${RESET} TaskUpdate: #1, #2, #3 → in_progress (PARALLEL)"
    sleep 0.5

    spinner "[Task #1] Analyzing code..." 10
    echo -e "${GREEN}✓${RESET} Task #1 completed"
    sleep 0.2

    spinner "[Task #2] Scanning security..." 12
    echo -e "${GREEN}✓${RESET} Task #2 completed"
    sleep 0.2

    spinner "[Task #3] Running tests..." 15
    echo -e "${GREEN}✓${RESET} Task #3 completed"
    sleep 0.3

    # Unblock and execute dependent task
    echo
    echo -e "${YELLOW}◆${RESET} Task #4 unblocked (3/3 dependencies resolved)"
    sleep 0.3
    echo -e "${CYAN}◆${RESET} TaskUpdate: #4 → in_progress"

    spinner "[Task #4] Generating report..." 8
    echo -e "${GREEN}✓${RESET} Task #4 completed"
    sleep 0.3

    echo
    echo -e "${GREEN}◆${RESET} All tasks completed with dependencies resolved!"
DEPS_SECTION
}

# Generate hook trigger section
generate_hook_trigger_section() {
    local hook_type="${1:-PreToolUse}"
    local output_script="$2"

    cat >> "$output_script" << HOOK_SECTION
    echo
    echo -e "\${DIM}────────────────────────────────────────\${RESET}"
    echo -e "\${CYAN}◆\${RESET} Hook triggered: \${YELLOW}${hook_type}\${RESET}"
    sleep 0.2
    echo -e "  \${DIM}→ Running permission check...\${RESET}"
    sleep 0.15
    echo -e "  \${DIM}→ Validating context budget...\${RESET}"
    sleep 0.15
    echo -e "  \${DIM}→ Checking skill injection...\${RESET}"
    sleep 0.15
    echo -e "\${GREEN}✓\${RESET} Hook approved execution"
    echo -e "\${DIM}────────────────────────────────────────\${RESET}"
    sleep 0.3
HOOK_SECTION
}

# Generate cinematic skill demo script
generate_cinematic_skill_script() {
    local name="$1"
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}-cinematic.sh"

    cat > "$output_script" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
# Auto-generated CINEMATIC skill demo script
# Features: parallel agents, task dependencies, hook visualization
set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

SPINNERS=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

spinner() {
    local message="$1"
    local cycles="${2:-15}"
    local i=0
    for ((c=0; c<cycles; c++)); do
        printf "\r${CYAN}${SPINNERS[$i]} ${message}${RESET}"
        i=$(( (i + 1) % ${#SPINNERS[@]} ))
        sleep 0.1
    done
    printf "\r%-70s\r" " "
}

main() {
    clear

    # Enhanced status bar
    echo -e "${DIM}[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m${RESET}"
    echo -e "${DIM}✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞${RESET}"
    echo -e "${DIM}>> bypass permissions on (shift+Tab to cycle)${RESET}"
    echo

SCRIPT_HEADER

    # Add skill activation with hook
    cat >> "$output_script" << ACTIVATION
    # Skill activation
    echo -e "\${CYAN}◆\${RESET} Activating skill: \${MAGENTA}${DEMO_NAME}\${RESET}"
    sleep 0.3
    echo -e "  \${DIM}→ Reading skills/${name}/SKILL.md\${RESET}"
    sleep 0.2
ACTIVATION

    if [[ -n "${RELATED_SKILLS:-}" ]]; then
        cat >> "$output_script" << RELATED
    echo -e "  \${DIM}→ Auto-injecting: ${RELATED_SKILLS}\${RESET}"
    sleep 0.2
RELATED
    fi

    cat >> "$output_script" << DESC
    echo -e "\${GREEN}✓\${RESET} ${DEMO_DESCRIPTION}"
    sleep 0.5
    echo

DESC

    # Add hook trigger visualization
    generate_hook_trigger_section "UserPromptSubmit" "$output_script"

    # Add parallel agents section for skills that use agents
    if [[ "$name" == "verify" ]] || [[ "$name" == "review-pr" ]] || [[ "$name" == "explore" ]]; then
        local agents="code-reviewer,security-auditor,test-generator,performance-engineer,accessibility-specialist,documentation-specialist"
        if [[ "$name" == "explore" ]]; then
            agents="codebase-analyzer,pattern-detector,architecture-mapper"
        fi
        generate_parallel_agent_section "$agents" "$output_script"
    fi

    # Add task dependency section
    generate_task_dependency_section "$output_script"

    # Add completion
    cat >> "$output_script" << COMPLETE

    echo
    echo -e "\${GREEN}\${BOLD}✓ ${DEMO_NAME} completed successfully!\${RESET}"
    echo
    echo -e "\${DIM}────────────────────────────────────────\${RESET}"
    echo -e "Stats: \${CYAN}6 agents\${RESET} | \${GREEN}4 tasks\${RESET} | \${YELLOW}2m 15s\${RESET}"
    echo -e "\${DIM}────────────────────────────────────────\${RESET}"
}

main
COMPLETE

    chmod +x "$output_script"
    log_success "Generated cinematic script: $output_script"
}

# ==================== STANDARD MODE FUNCTIONS ====================

# Generate skill demo script
generate_skill_script() {
    local name="$1"
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}.sh"

    cat > "$output_script" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
# Auto-generated skill demo script
set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

SPINNERS=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

spinner() {
    local message="$1"
    local cycles="${2:-15}"  # Number of spinner cycles (each ~0.1s)
    local i=0
    for ((c=0; c<cycles; c++)); do
        printf "\r${CYAN}${SPINNERS[$i]} ${message}${RESET}"
        i=$(( (i + 1) % ${#SPINNERS[@]} ))
        sleep 0.1
    done
    printf "\r%-60s\r" " "
}

main() {
    clear

    # Status bar
    echo -e "${DIM}[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m${RESET}"
    echo -e "${DIM}✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞${RESET}"
    echo -e "${DIM}>> bypass permissions on (shift+Tab to cycle)${RESET}"
    echo

SCRIPT_HEADER

    # Add skill activation
    cat >> "$output_script" << ACTIVATION
    # Skill activation
    echo -e "\${CYAN}◆\${RESET} Activating skill: \${MAGENTA}${DEMO_NAME}\${RESET}"
    sleep 0.3
    echo -e "  \${DIM}→ Reading skills/${name}/SKILL.md\${RESET}"
    sleep 0.2
ACTIVATION

    if [[ -n "${RELATED_SKILLS:-}" ]]; then
        cat >> "$output_script" << RELATED
    echo -e "  \${DIM}→ Auto-injecting: ${RELATED_SKILLS}\${RESET}"
    sleep 0.2
RELATED
    fi

    cat >> "$output_script" << DESC
    echo -e "\${GREEN}✓\${RESET} ${DEMO_DESCRIPTION}"
    sleep 0.5
    echo

DESC

    # Add tasks based on phases
    local task_num=1
    while IFS= read -r phase; do
        [[ -z "$phase" ]] && continue
        cat >> "$output_script" << TASK
    # Task ${task_num}
    echo -e "\${CYAN}◆\${RESET} TaskCreate: Created task #${task_num} \"${phase}\""
    sleep 0.3
TASK
        ((task_num++))
    done <<< "$PHASES"

    echo "    echo" >> "$output_script"

    # Execute tasks
    task_num=1
    while IFS= read -r phase; do
        [[ -z "$phase" ]] && continue
        cat >> "$output_script" << EXECUTE
    echo -e "\${CYAN}◆\${RESET} TaskUpdate: Task #${task_num} → in_progress"
    spinner "[Task #${task_num}] ${phase}..." 15
    echo -e "\${GREEN}✓\${RESET} [Task #${task_num}] ${phase} \${GREEN}completed\${RESET}"
    sleep 0.3
EXECUTE
        ((task_num++))
    done <<< "$PHASES"

    # Add completion
    local total_tasks=$((task_num - 1))
    cat >> "$output_script" << COMPLETE

    echo
    echo -e "\${CYAN}◆\${RESET} TaskList: ${total_tasks}/${total_tasks} completed"
    sleep 0.3
    echo -e "\${GREEN}\${BOLD}✓ ${DEMO_NAME} completed successfully!\${RESET}"
}

main
COMPLETE

    chmod +x "$output_script"
    log_success "Generated script: $output_script"
}

# Generate agent demo script
generate_agent_script() {
    local name="$1"
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}.sh"

    cat > "$output_script" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

SPINNERS=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

spinner() {
    local message="$1"
    local duration="${2:-1}"
    local end=$((SECONDS + duration))
    local i=0
    while [ $SECONDS -lt $end ]; do
        printf "\r${CYAN}${SPINNERS[$i]} ${message}${RESET}"
        i=$(( (i + 1) % ${#SPINNERS[@]} ))
        sleep 0.1
    done
    printf "\r%-60s\r" " "
}

main() {
    clear

    echo -e "${DIM}[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m${RESET}"
    echo -e "${DIM}✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞${RESET}"
    echo

SCRIPT_HEADER

    cat >> "$output_script" << AGENT_SPAWN
    # Agent spawn
    echo -e "\${YELLOW}⚡\${RESET} Spawning \${MAGENTA}${DEMO_NAME}\${RESET} agent via Task tool..."
    sleep 0.5
    echo

    # Tools usage
    echo -e "\${CYAN}◆\${RESET} Tools: ${AGENT_TOOLS}"
    sleep 0.3
    echo -e "\${CYAN}◆\${RESET} Skills: ${AGENT_SKILLS}"
    sleep 0.3
    echo

    # Agent working
    echo -e "\${CYAN}◆\${RESET} TaskCreate: Created task #1 \"Analyze codebase\""
    sleep 0.3
    echo -e "\${CYAN}◆\${RESET} TaskUpdate: Task #1 → in_progress"
    spinner "[Agent] Analyzing codebase..." 20

    echo -e "\${GREEN}✓\${RESET} Read 15 files"
    sleep 0.2
    echo -e "\${GREEN}✓\${RESET} Found 8 patterns"
    sleep 0.2
    echo -e "\${GREEN}✓\${RESET} Identified 3 improvements"
    sleep 0.3

    echo
    echo -e "\${CYAN}◆\${RESET} TaskUpdate: Task #1 → completed"
    sleep 0.3
    echo -e "\${GREEN}\${BOLD}✓ ${DEMO_NAME} agent completed!\${RESET}"
}

main
AGENT_SPAWN

    chmod +x "$output_script"
    log_success "Generated script: $output_script"
}

# Generate plugin demo script
generate_plugin_script() {
    local name="$1"
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}.sh"

    cat > "$output_script" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

type_text() {
    local text="$1"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep 0.03
    done
    echo
}

main() {
    clear

    echo -e "${DIM}[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m${RESET}"
    echo

SCRIPT_HEADER

    cat >> "$output_script" << PLUGIN_INSTALL
    # Plugin install
    echo -n -e "\${GREEN}>\${RESET} "
    type_text "/plugin install ${name}"
    sleep 0.5
    echo

    echo "Installing ${DEMO_NAME}..."
    sleep 0.3
    echo -e "  \${DIM}→ Downloading from marketplace\${RESET}"
    sleep 0.4
    echo -e "  \${DIM}→ Validating plugin.json\${RESET}"
    sleep 0.3
    echo -e "  \${DIM}→ Registering ${SKILLS_COUNT} skills\${RESET}"
    sleep 0.3
    echo -e "  \${DIM}→ Registering ${AGENTS_COUNT} agents\${RESET}"
    sleep 0.3
    echo -e "  \${DIM}→ Setting up ${HOOKS_COUNT} hooks\${RESET}"
    sleep 0.3
    echo
    echo -e "\${GREEN}✓\${RESET} ${DEMO_NAME} v${PLUGIN_VERSION} installed successfully!"
    sleep 0.5

    echo
    echo -e "\${CYAN}Available commands:\${RESET}"
    echo -e "  /ork:doctor     - Health check"
    echo -e "  /ork:configure  - Configuration wizard"
    echo -e "  /ork:explore    - Explore codebase"
    sleep 1

    echo
    echo -e "\${GREEN}\${BOLD}Ready to use!\${RESET}"
}

main
PLUGIN_INSTALL

    chmod +x "$output_script"
    log_success "Generated script: $output_script"
}

# Generate tutorial demo script
generate_tutorial_script() {
    local title="$1"
    local name=$(normalize_name "$title")
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}.sh"

    cat > "$output_script" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
set -euo pipefail

GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

type_text() {
    local text="$1"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep 0.03
    done
    echo
}

main() {
    clear

SCRIPT_HEADER

    # Add title with variable interpolation
    cat >> "$output_script" << TITLE
    echo -e "\${BOLD}\${MAGENTA}Tutorial: ${title}\${RESET}"
    echo -e "\${DIM}────────────────────────────────────────\${RESET}"
    echo

TITLE

    cat >> "$output_script" << TUTORIAL
    # Tutorial content
    echo -e "\${CYAN}Step 1:\${RESET} Setting up the project"
    sleep 0.5
    echo -n -e "\${GREEN}>\${RESET} "
    type_text "mkdir my-project && cd my-project"
    sleep 0.3

    echo
    echo -e "\${CYAN}Step 2:\${RESET} Creating the main file"
    sleep 0.5
    echo -n -e "\${GREEN}>\${RESET} "
    type_text "touch main.py"
    sleep 0.3

    echo
    echo -e "\${CYAN}Step 3:\${RESET} Writing code"
    sleep 0.5
    echo -e "\${DIM}# Your code here...\${RESET}"
    sleep 1

    echo
    echo -e "\${GREEN}\${BOLD}✓ Tutorial complete!\${RESET}"
}

main
TUTORIAL

    chmod +x "$output_script"
    log_success "Generated script: $output_script"
}

# Generate CLI demo script
generate_cli_script() {
    local command="$1"
    local name=$(normalize_name "$command" | cut -c1-30)
    local output_script="${OUTPUT_DIR}/scripts/demo-${name}.sh"

    cat > "$output_script" << SCRIPT_HEADER
#!/usr/bin/env bash
set -euo pipefail

GREEN="\033[32m"
CYAN="\033[36m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

type_text() {
    local text="\$1"
    for ((i=0; i<\${#text}; i++)); do
        echo -n "\${text:\$i:1}"
        sleep 0.03
    done
    echo
}

main() {
    clear

    echo -e "\${DIM}Terminal Demo\${RESET}"
    echo

    echo -n -e "\${GREEN}>\${RESET} "
    type_text "${command}"
    sleep 0.5

    echo
    echo -e "\${DIM}[Command output would appear here]\${RESET}"
    sleep 2

    echo
    echo -e "\${GREEN}\${BOLD}✓ Done!\${RESET}"
}

main
SCRIPT_HEADER

    chmod +x "$output_script"
    log_success "Generated script: $output_script"
}

# Generate VHS tape file
generate_tape() {
    local name="$1"
    local format="$2"  # horizontal, vertical, or square

    local width height fontsize padding suffix script_name sleep_time
    case "$format" in
        horizontal)
            width=1400; height=650; fontsize=18; padding=30; suffix=""
            ;;
        vertical)
            width=900; height=1400; fontsize=22; padding=40; suffix="-vertical"
            ;;
        square)
            width=1080; height=1080; fontsize=20; padding=35; suffix="-square"
            ;;
    esac

    # Use cinematic script if in cinematic mode
    if [[ "$CINEMATIC_MODE" == "true" ]]; then
        script_name="demo-${name}-cinematic.sh"
        sleep_time="25s"  # Longer for cinematic
        suffix="${suffix}-cinematic"
    else
        script_name="demo-${name}.sh"
        sleep_time="12s"
    fi

    local tape_file="${OUTPUT_DIR}/tapes/sim-${name}${suffix}.tape"

    cat > "$tape_file" << TAPE
Output ../output/${name}-demo${suffix}.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize ${fontsize}
Set Width ${width}
Set Height ${height}
Set Theme "Dracula"
Set Padding ${padding}
Set Framerate 30
Set TypingSpeed 50ms

Type "../scripts/${script_name}"
Enter
Sleep ${sleep_time}
TAPE

    log_success "Generated tape: $tape_file"
}

# Generate cinematic VHS tape with enhanced settings
generate_cinematic_tape() {
    local name="$1"
    local format="$2"

    local width height fontsize padding suffix
    case "$format" in
        horizontal)
            width=1920; height=1080; fontsize=20; padding=40; suffix="-cinematic"
            ;;
        vertical)
            width=1080; height=1920; fontsize=24; padding=50; suffix="-vertical-cinematic"
            ;;
    esac

    local tape_file="${OUTPUT_DIR}/tapes/sim-${name}${suffix}.tape"

    cat > "$tape_file" << TAPE
Output ../output/${name}-demo${suffix}.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize ${fontsize}
Set Width ${width}
Set Height ${height}
Set Theme "Dracula"
Set Padding ${padding}
Set Framerate 30
Set TypingSpeed 40ms
Set CursorBlink true

# Cinematic intro delay
Sleep 1s

Type "../scripts/demo-${name}-cinematic.sh"
Enter
Sleep 30s

# Cinematic outro
Sleep 1s
TAPE

    log_success "Generated cinematic tape: $tape_file"
}

# Main execution
main() {
    log_info "Demo Producer: Generating $CONTENT_TYPE demo for '$CONTENT_SOURCE'"

    # Ensure output directories exist
    mkdir -p "${OUTPUT_DIR}/scripts" "${OUTPUT_DIR}/tapes" "${OUTPUT_DIR}/output"

    local demo_name

    case "$CONTENT_TYPE" in
        skill)
            extract_skill_metadata "$CONTENT_SOURCE"
            demo_name="$CONTENT_SOURCE"
            if [[ "$CINEMATIC_MODE" == "true" ]]; then
                generate_cinematic_skill_script "$demo_name"
            else
                generate_skill_script "$demo_name"
            fi
            ;;
        agent)
            extract_agent_metadata "$CONTENT_SOURCE"
            demo_name="$CONTENT_SOURCE"
            generate_agent_script "$demo_name"
            ;;
        plugin)
            extract_plugin_metadata "$CONTENT_SOURCE"
            demo_name="$CONTENT_SOURCE"
            generate_plugin_script "$demo_name"
            ;;
        tutorial)
            demo_name=$(normalize_name "$CONTENT_SOURCE")
            DEMO_NAME="$CONTENT_SOURCE"
            DEMO_DESCRIPTION="Learn $CONTENT_SOURCE step by step"
            generate_tutorial_script "$CONTENT_SOURCE"
            ;;
        cli)
            demo_name=$(normalize_name "$CONTENT_SOURCE" | cut -c1-30)
            generate_cli_script "$CONTENT_SOURCE"
            ;;
        code)
            log_warn "Code walkthrough generation not yet implemented"
            exit 1
            ;;
        *)
            log_error "Unknown content type: $CONTENT_TYPE"
            exit 1
            ;;
    esac

    # Generate VHS tapes for requested formats
    IFS=',' read -ra FORMATS <<< "$FORMAT"
    for fmt in "${FORMATS[@]}"; do
        if [[ "$CINEMATIC_MODE" == "true" ]]; then
            generate_cinematic_tape "$demo_name" "$fmt"
        else
            generate_tape "$demo_name" "$fmt"
        fi
    done

    echo
    log_success "Generation complete!"
    echo
    if [[ "$CINEMATIC_MODE" == "true" ]]; then
        echo "Next steps (CINEMATIC MODE):"
        echo "  1. cd ${OUTPUT_DIR}/tapes"
        echo "  2. vhs sim-${demo_name}-cinematic.tape"
        echo "  3. (Optional) Generate Manim animation:"
        echo "     cd ${PROJECT_ROOT}/skills/manim-visualizer/scripts"
        echo "     python generate.py agent-spawning --preset verify"
        echo "  4. Copy outputs to public/ folder"
        echo "  5. Preview: cd ${OUTPUT_DIR} && npm run preview"
        echo "  6. Render: npx remotion render ${demo_name^}CinematicDemo"
    else
        echo "Next steps:"
        echo "  1. cd ${OUTPUT_DIR}/tapes"
        echo "  2. vhs sim-${demo_name}.tape"
        echo "  3. Copy output to public/ folder"
        echo "  4. Add Remotion composition"
        echo "  5. Render final video"
    fi
}

main
