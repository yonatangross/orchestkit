# Bare Eval Invocation Patterns

Detailed patterns for each `--bare` eval scenario.

## 1. Batch Grading (Most Common)

Grade all assertions for an output in a single call:

```bash
grading_prompt="You are an assertion grader. Grade this output against EACH assertion.
For each, return: {\"name\": \"...\", \"verdict\": \"PASS\"|\"FAIL\", \"reason\": \"...\"}
Return ONLY a valid JSON array.

ASSERTIONS:
$assertions_json

OUTPUT:
$output_text"

result=$(claude -p "$grading_prompt" --bare --max-turns 1 --output-format text)
```

### Fallback: Per-Assertion Grading

If batch fails (malformed JSON), fall back to grading one assertion at a time.

> **CC 2.1.88 note**: The StructuredOutput schema cache bug that caused ~50% failure
> rate with multiple schemas has been fixed. Schema failures are now exceptional.
> If you see repeated failures, investigate the prompt/schema rather than assuming
> cache corruption.

```bash
grading_prompt="Grade this output against the assertion.
Output ONLY 'PASS' or 'FAIL' followed by a one-line reason.

ASSERTION: $assertion_check

OUTPUT:
$output_text"

result=$(claude -p "$grading_prompt" --bare --max-turns 1 --output-format text)
```

## 2. Trigger Classification

Test which skill a prompt would match:

```bash
classification_prompt="Which skill would be triggered by this user prompt: \"$prompt\"

Available skills:
$SKILLS_CATALOG"

claude -p "$classification_prompt" \
    --bare \
    --system-prompt "$CLASSIFIER_SYSTEM_PROMPT" \
    --output-format json \
    --json-schema "$TRIGGER_SCHEMA" \
    --max-turns 2
```

### Repetition for Confidence

Run multiple reps and check consistency:

```bash
for ((i=1; i<=reps; i++)); do
    result=$(claude -p "$prompt" --bare --json-schema "$schema" --output-format json)
    # Parse and aggregate
done
```

## 3. Description Optimization

Iteratively improve a skill description for better trigger accuracy:

```bash
improve_prompt="Current description: $current_desc

These prompts SHOULD trigger but DIDN'T:
$failures

Rules:
- Under 200 words
- Include WHAT and WHEN
- Third person
- Specific trigger keywords

Output ONLY the improved description."

new_desc=$(echo "$improve_prompt" | claude -p --bare --max-turns 1 --output-format text)
```

## 4. Force-Skill Eval (Isolated Quality)

Test skill content quality without plugin routing — inject SKILL.md body directly:

```bash
# Strip YAML frontmatter (macOS-compatible)
skill_content=$(awk 'BEGIN{skip=0} /^---$/{skip++; next} skip>=2{print}' "$SKILL_PATH")

claude -p "$prompt" \
    --bare \
    --print \
    --no-session-persistence \
    --max-budget-usd 0.50 \
    --append-system-prompt "$skill_content"
```

**Key:** `--print` forces text-only output (no tool calls). Combined with `--bare`, this is the fastest eval mode — pure text generation with skill context.

## 5. Baseline Comparison

Run without any skill context for A/B comparison:

```bash
claude -p "$prompt" \
    --bare \
    --dangerously-skip-permissions \
    --max-turns 3 \
    --output-format json \
    --json-schema "$QUALITY_SCHEMA" \
    --no-session-persistence \
    --max-budget-usd 0.50
```

> **CC 2.1.88**: The `--json-schema` flag is now safe to use with multiple schemas
> in a single session. The StructuredOutput schema cache bug (~50% failure rate)
> has been fixed. You can safely chain `--json-schema` calls across batch grading,
> trigger classification, quality scoring, and baseline comparison.

## Flag Compatibility Matrix

| Flag | Compatible with --bare? | Notes |
|------|------------------------|-------|
| `--max-turns` | Yes | Limits turn count |
| `--output-format` | Yes | json, text, stream-json |
| `--json-schema` | Yes | Structured output |
| `--system-prompt` | Yes | Override system prompt |
| `--append-system-prompt` | Yes | Append to system prompt |
| `--print` | Yes | Text-only, no tools |
| `--no-session-persistence` | Yes | No session file |
| `--max-budget-usd` | Yes | Cost cap |
| `--model` | Yes | Model override |
| `--plugin-dir` | **No** | Contradicts --bare |
| `--mcp-config` | Check | MCP may need network |
| `--dangerously-skip-permissions` | Yes | Useful for CI |
| `--settings` | Yes | Custom settings file |

## Timeout Wrapper

Use a portable timeout for CI environments:

```bash
# eval-common.sh provides run_with_timeout()
run_with_timeout 120 claude -p "$prompt" --bare --max-turns 1 --output-format text
```
