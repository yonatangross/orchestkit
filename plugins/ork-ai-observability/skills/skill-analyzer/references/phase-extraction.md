# Phase Extraction

## Phase Header Patterns

Skills define workflow phases using Markdown headers:

```markdown
## Phase 1: Initial Search
### Phase 2: Deep Analysis
## Step 1: Gather Context
```

## Extraction Regex

```python
phase_pattern = r'#{2,3}\s*(?:Phase|Step)\s*(\d+)[:\s]+([^\n]+)'
```

## Parallel Detection

Phases are marked parallel if they contain:
- `# PARALLEL` comment
- Multiple tool calls in same code block
- "in parallel" or "simultaneously" in description

```markdown
## Phase 2: Parallel Analysis

```python
# PARALLEL - Launch all at once
Task(agent="code-quality-reviewer")
Task(agent="security-auditor")
Task(agent="test-generator")
```
```

## Tool Extraction

Extract tool names from code blocks:

```python
tool_pattern = r'\b(Grep|Glob|Read|Write|Edit|Bash|Task|WebFetch|WebSearch)\b'
tools = set(re.findall(tool_pattern, phase_content))
```

## Output Structure

```typescript
interface WorkflowPhase {
  name: string;        // "Phase 1: Initial Search"
  description: string; // First 200 chars of phase content
  tools: string[];     // ["Grep", "Glob", "Task"]
  is_parallel: boolean;// true if parallel execution
}
```
