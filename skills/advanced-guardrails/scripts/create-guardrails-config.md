---
name: create-guardrails-config
description: Create guardrails configuration with auto-detected LLM provider. Use when setting up LLM safety guardrails.
user-invocable: true
argument-hint: [config-name]
---

Create guardrails config: $ARGUMENTS

## Guardrails Context (Auto-Detected)

- **LLM Provider**: !`grep -r "openai\|anthropic\|google" .env* package.json 2>/dev/null | head -1 | grep -oE 'openai|anthropic|google' || echo "openai (recommended)"`
- **Model**: !`grep -r "gpt-4\|claude\|gemini" .env* 2>/dev/null | head -1 | grep -oE 'gpt-4|claude|gemini' || echo "gpt-4o"`
- **Embedding Model**: !`grep -r "embedding\|text-embedding" .env* 2>/dev/null | head -1 | grep -oE 'text-embedding-[0-9a-z-]+' || echo "text-embedding-3-small"`
- **Existing Config**: !`find . -name "*guardrail*" -o -name "*nemo*" 2>/dev/null | head -3 || echo "None found"`

## Guardrails Configuration

```yaml
# $ARGUMENTS Guardrails Configuration
# Generated: !`date +%Y-%m-%d`
# Provider: !`grep -r "openai\|anthropic" .env* 2>/dev/null | head -1 | grep -oE 'openai|anthropic' || echo "openai"`

models:
  - type: main
    engine: !`grep -r "openai\|anthropic" .env* 2>/dev/null | head -1 | grep -oE 'openai|anthropic' || echo "openai"`
    model: !`grep -r "gpt-4\|claude" .env* 2>/dev/null | head -1 | grep -oE 'gpt-4[^"]*|claude-[0-9]' || echo "gpt-4o"`
    parameters:
      temperature: 0.7
      max_tokens: 1024

  - type: embeddings
    engine: !`grep -r "openai\|anthropic" .env* 2>/dev/null | head -1 | grep -oE 'openai|anthropic' || echo "openai"`
    model: !`grep -r "embedding" .env* 2>/dev/null | head -1 | grep -oE 'text-embedding-[0-9a-z-]+' || echo "text-embedding-3-small"`

rails:
  config:
    guardrails_ai:
      validators:
        - name: toxic_language
          parameters:
            threshold: 0.5
        - name: guardrails_pii
          parameters:
            entities: ["EMAIL", "PHONE", "SSN"]
```

## Usage

1. Review detected provider above
2. Save to: `config/$ARGUMENTS.yaml`
3. Configure validators for your use case
