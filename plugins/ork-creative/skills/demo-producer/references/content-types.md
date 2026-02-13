# Content Type Templates

## Overview

Each content type has a specific template that determines:
- Terminal simulation flow
- Key visual elements
- Timing and pacing
- Hook and CTA text

## Skill Demo Template

**Duration**: 15-25s
**Hook**: "{skill_name} automates {key_action} in Claude Code"

```bash
# Phase 1: Activation (2s)
◆ Activating skill: {name}
  → Reading skills/{name}/SKILL.md
  → Auto-injecting: {related_skills}
✓ {description}

# Phase 2: Task Creation (3s)
◆ TaskCreate: Created task #1 "{phase_1}"
◆ TaskCreate: Created task #2 "{phase_2}"

# Phase 3: Execution (8-15s)
◆ TaskUpdate: Task #1 → in_progress
⠋ [Task #1] {action}...
✓ [Task #1] {phase_1} completed
◆ TaskUpdate: Task #2 → in_progress
⠋ [Task #2] {action}...
✓ [Task #2] {phase_2} completed

# Phase 4: Results (2s)
◆ TaskList: 2/2 completed
✓ {summary}
```

## Agent Demo Template

**Duration**: 20-30s
**Hook**: "{agent_name} - Your AI {specialty} assistant"

```bash
# Phase 1: Spawning (2s)
⚡ Spawning {agent_name} agent via Task tool...

# Phase 2: Tool Usage (5s)
◆ Read: {file_count} files analyzed
◆ Grep: {pattern_count} patterns found
◆ Bash: Running {command}

# Phase 3: Parallel Agents (8s) - if applicable
⚡ Spawning {n} parallel sub-agents...
◆ TaskUpdate: Task #1 → in_progress
◆ TaskUpdate: Task #2 → in_progress
✓ [Task #1] {sub_agent_1} completed
✓ [Task #2] {sub_agent_2} completed

# Phase 4: Synthesis (5s)
◆ Synthesizing results from {n} agents...
✓ {final_output}
```

## Plugin Demo Template

**Duration**: 20-30s
**Hook**: "{plugin_name} - {tagline}"

```bash
# Phase 1: Discovery (3s)
> /plugin marketplace search {plugin}

OrchestKit Marketplace
──────────────────────
{plugin_name} v{version}
{description}
★ {stars} | ↓ {downloads}

# Phase 2: Installation (4s)
> /plugin install {plugin}

Installing {plugin_name}...
  → Downloading from marketplace
  → Validating plugin.json
  → Registering {skills_count} skills
  → Registering {agents_count} agents
  → Setting up {hooks_count} hooks
✓ {plugin_name} installed successfully

# Phase 3: Configuration (5s)
> /ork:configure

{configuration_wizard}

# Phase 4: Features (8s)
{feature_showcase}
```

## Tutorial Demo Template

**Duration**: 30-60s
**Hook**: "{title} in {time}"

```bash
# Phase 1: Problem Statement (3s)
# {problem_description}

# Phase 2: Solution Setup (5s)
> {setup_commands}

# Phase 3: Code Writing (15-30s)
# Show typing code with explanations
> cat {file}

{code_content}

# Phase 4: Execution (5s)
> {run_command}
{output}

# Phase 5: Result (3s)
✓ {success_message}
```

## CLI Tool Demo Template

**Duration**: 10-20s
**Hook**: "{tool_name} - {one_liner}"

```bash
# Phase 1: Command (2s)
> {command}

# Phase 2: Execution (5-12s)
{animated_output}

# Phase 3: Result (3s)
✓ {result_summary}
```

## Code Walkthrough Template

**Duration**: 30-60s
**Hook**: "Understanding {component} in {project}"

```bash
# Phase 1: File Overview (3s)
> cat {file_path}

# Phase 2: Key Sections (15-40s)
# Navigate through sections with highlights
# Lines {start}-{end}: {explanation}

{code_block_1}

# Purpose: {explanation_1}

{code_block_2}

# Pattern: {pattern_name}

# Phase 3: Connections (5s)
# Shows relationships to other files

# Phase 4: Summary (3s)
# Key takeaways
```

## Duration Guidelines

| Style | Min | Max | Best For |
|-------|-----|-----|----------|
| Quick | 6s | 10s | Single feature, social teasers |
| Standard | 15s | 25s | Full workflow, typical demo |
| Tutorial | 30s | 60s | Educational content |
| Cinematic | 60s | 120s | Product launches, keynotes |
