---
name: automate-form
description: Automate form filling with validation and selector detection. Use when automating web forms.
user-invocable: true
argument-hint: [url] [form-selector]
allowed-tools: Bash, Read, Write
---

Automate form at: $ARGUMENTS

## Form Context (Auto-Validated)

- **Agent-Browser Available**: !`which agent-browser >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found - install: npm install -g @agent-browser/cli"`
- **Curl Available**: !`which curl >/dev/null 2>&1 && echo "✅ Yes" || echo "❌ Not found"`

## Your Task

Automate form filling for: **$ARGUMENTS**

Extract the URL and form selector from the arguments:
- If two arguments provided: first is URL, second is form selector
- If one argument provided: use it as URL, default selector is "form"

Then:
1. Validate the URL is accessible
2. Discover the form structure using agent-browser
3. Fill the form fields
4. Submit and verify

## Form Automation Workflow

### 1. Discover Form Structure

```bash
# Extract URL from arguments (first word)
URL=$(echo "$ARGUMENTS" | awk '{print $1}')

agent-browser open "$URL"
agent-browser wait --load networkidle
agent-browser snapshot -i
```

### 2. Fill Form

```bash
#!/bin/bash
# Extract URL from arguments
FORM_URL=$(echo "$ARGUMENTS" | awk '{print $1}')

agent-browser open "$FORM_URL"
agent-browser wait --load networkidle

# Fill fields (update refs after discovery)
agent-browser fill "@e1" "Value 1"
agent-browser fill "@e2" "Value 2"
agent-browser click "@e10"  # Submit button

agent-browser wait --load networkidle
agent-browser snapshot -i
agent-browser screenshot form-result.png

agent-browser close
```

### 3. Full Automation Script

Use the form-automation.sh template:

1. Run discovery mode to see form structure
2. Note @refs for each field
3. Update FORM_FIELDS array
4. Set DISCOVERY_MODE=false
5. Run automation

## Form Fields

After discovery, configure:
- Text inputs: `@e1|fill|value`
- Selects: `@e2|select|option`
- Checkboxes: `@e3|check|`
- Submit: `@e10|click|`
