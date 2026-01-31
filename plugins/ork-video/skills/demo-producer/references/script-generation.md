# Script Generation

## Generator Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Script Generator                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input                                                       │
│  ├── Content Type (skill|agent|plugin|tutorial|cli|code)    │
│  ├── Content Source (file path or description)              │
│  ├── Style (quick|standard|tutorial|cinematic)              │
│  └── Options (hooks, agents, phases)                        │
│                                                              │
│  Process                                                     │
│  ├── 1. Parse content source                                │
│  ├── 2. Extract key information                             │
│  ├── 3. Select template                                     │
│  ├── 4. Inject dynamic content                              │
│  └── 5. Generate timing                                     │
│                                                              │
│  Output                                                      │
│  ├── demo-{name}.sh (bash simulator)                        │
│  ├── sim-{name}.tape (horizontal VHS)                       │
│  └── sim-{name}-vertical.tape (vertical VHS)                │
└─────────────────────────────────────────────────────────────┘
```

## Bash Simulator Template

```bash
#!/usr/bin/env bash
# Auto-generated demo script for {name}
# Type: {content_type} | Style: {style}
# Generated: {timestamp}

set -euo pipefail

# Colors
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
MAGENTA="\033[35m"
DIM="\033[2m"
BOLD="\033[1m"
RESET="\033[0m"

# Spinners
SPINNERS=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")

# Functions
type_text() {
    local text="$1"
    local delay="${2:-0.03}"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep "$delay"
    done
    echo
}

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
    printf "\r"
}

status_bar() {
    echo -e "${DIM}[Opus 4.5] ████████░░ 42% | ~/project git:(main) | ● 3m${RESET}"
    echo -e "${DIM}✓ Bash ×3 | ✓ Read ×5 | ✓ Grep ×2 | ✓ Task ×∞${RESET}"
    echo -e "${DIM}>> bypass permissions on (shift+Tab to cycle)${RESET}"
    echo
}

task_create() {
    echo -e "${CYAN}◆${RESET} TaskCreate: Created task #$1 \"$2\""
    sleep 0.3
}

task_update() {
    echo -e "${CYAN}◆${RESET} TaskUpdate: Task #$1 → $2"
    sleep 0.2
}

task_complete() {
    echo -e "${GREEN}✓${RESET} [Task #$1] $2 ${GREEN}completed${RESET}"
    sleep 0.2
}

activate_skill() {
    echo -e "${CYAN}◆${RESET} Activating skill: ${MAGENTA}$1${RESET}"
    sleep 0.3
    echo -e "  ${DIM}→ Reading skills/$1/SKILL.md${RESET}"
    sleep 0.2
    if [ -n "${2:-}" ]; then
        echo -e "  ${DIM}→ Auto-injecting: $2${RESET}"
        sleep 0.2
    fi
    echo -e "${GREEN}✓${RESET} $3"
    sleep 0.3
}

spawn_agents() {
    echo -e "${YELLOW}⚡${RESET} Spawning $1 parallel agents via Task tool..."
    sleep 0.5
}

# Main demo
main() {
    clear
    status_bar

    {DEMO_CONTENT}

    echo
    echo -e "${GREEN}${BOLD}Demo complete!${RESET}"
}

main
```

## VHS Tape Template

### Horizontal (16:9)
```tape
Output ../output/{name}-demo.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 18
Set Width 1400
Set Height 650
Set Theme "Dracula"
Set Padding 30
Set Framerate 30
Set TypingSpeed 50ms

Type "../scripts/demo-{name}.sh"
Enter
Sleep {duration}s
```

### Vertical (9:16)
```tape
Output ../output/{name}-demo-vertical.mp4
Set Shell "bash"
Set FontFamily "Menlo"
Set FontSize 22
Set Width 900
Set Height 1400
Set Theme "Dracula"
Set Padding 40
Set Framerate 30
Set TypingSpeed 50ms

Type "../scripts/demo-{name}.sh"
Enter
Sleep {duration}s
```

## Content Extraction

### From SKILL.md
```bash
# Extract frontmatter
name=$(grep "^name:" SKILL.md | cut -d: -f2 | tr -d ' ')
description=$(grep "^description:" SKILL.md | cut -d: -f2-)
tags=$(grep "^tags:" SKILL.md | sed 's/tags: \[//' | sed 's/\]//')

# Extract phases from ## headers
phases=$(grep "^## " SKILL.md | sed 's/## //')
```

### From Agent Markdown
```bash
# Extract from frontmatter
name=$(grep "^name:" agent.md | cut -d: -f2 | tr -d ' ')
skills=$(grep "^  - " agent.md | sed 's/  - //')
tools=$(grep "tools:" -A 10 agent.md | grep "^  - " | sed 's/  - //')
```

### From plugin.json
```bash
# Extract with jq
name=$(jq -r '.name' plugin.json)
version=$(jq -r '.version' plugin.json)
skills_count=$(jq '.skills | length' plugin.json)
agents_count=$(jq '.agents | length' plugin.json)
```

### From Custom Input
```bash
# Parse tutorial/cli description
title="$1"
# Generate structure based on title keywords
```

## Timing Calculation

```bash
# Base timing per element
ACTIVATION_TIME=2
TASK_CREATE_TIME=0.3
TASK_UPDATE_TIME=0.2
SPINNER_TIME=1
COMPLETION_TIME=0.3
RESULT_TIME=2

# Calculate total
calculate_duration() {
    local phases=$1
    local agents=$2

    total=$ACTIVATION_TIME
    total=$((total + phases * (TASK_CREATE_TIME + SPINNER_TIME + COMPLETION_TIME)))
    total=$((total + agents * 2))
    total=$((total + RESULT_TIME))

    echo $total
}
```
