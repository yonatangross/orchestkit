---
title: "Token Optimization — YAML Mode"
impact: "MEDIUM"
impactDescription: "Using JSON for all specs wastes ~30% tokens on syntax characters (braces, quotes, commas) that YAML eliminates"
tags: [json-render, yaml, tokens, optimization, streaming, cost]
---

## Token Optimization — YAML Mode

json-render supports both JSON and YAML spec formats. YAML uses ~30% fewer tokens than equivalent JSON because it eliminates braces, brackets, quotes around keys, and trailing commas. For standalone mode (formerly "generate"), YAML is the default choice. Note: "generate"/"chat" mode names were deprecated in v0.12.1 — use "standalone"/"inline" instead.

**Incorrect:**
```typescript
// Always using JSON regardless of use case — wastes tokens
const systemPrompt = `Generate a json-render spec in JSON format:
{
  "root": "card-1",
  "elements": {
    "card-1": {
      "type": "Card",
      "props": {
        "title": "Welcome",
        "description": "Getting started guide"
      },
      "children": ["btn-1", "btn-2"]
    },
    "btn-1": {
      "type": "Button",
      "props": {
        "label": "Continue",
        "variant": "default"
      }
    },
    "btn-2": {
      "type": "Button",
      "props": {
        "label": "Skip",
        "variant": "ghost"
      }
    }
  }
}`
// ~180 tokens for syntax overhead
```

**Correct:**
```typescript
// YAML for standalone mode — 30% fewer tokens.
// Do not hand-write the prompt: yamlPrompt() derives it from the catalog, so it
// stays in sync when components change.
import { createYamlStreamCompiler, yamlPrompt } from '@json-render/yaml'
import { Renderer, defineRegistry } from '@json-render/react'
import type { Spec } from '@json-render/core'

const systemPrompt = yamlPrompt(catalog, { mode: 'standalone' })

// There is no sync parseYamlSpec(). The compiler is incremental: push text,
// then flush to finalise. A complete string is just a single push.
const compiler = createYamlStreamCompiler<Spec>()
compiler.push(yamlString)
const { result: spec } = compiler.flush()

const { registry } = defineRegistry(catalog, { components })
<Renderer spec={spec} registry={registry} />
```

The same compiler backs streaming: push each chunk as it arrives and read
`newPatches` to apply progressive updates, rather than waiting for the whole document.

### Format Selection Criteria

| Criterion | JSON | YAML |
|-----------|------|------|
| Inline mode / streaming (progressive render) | Required | Not supported |
| Standalone mode | Works but wasteful | 30% fewer tokens |
| Token cost sensitivity | Higher | Lower |
| Parsing reliability | Native JSON.parse | Requires yaml parser |
| AI familiarity | Higher (more training data) | High (common in configs) |
| Spec debugging | Easy (structured) | Easy (readable) |

### Decision Rule

```
If inline mode / streaming (progressive render needed) → JSON
If standalone AND token cost matters → YAML
If standalone AND debugging matters → either (both readable)
Default for standalone → YAML
```

### Token Comparison Example

A spec with 5 components:
- JSON: ~450 tokens
- YAML: ~310 tokens
- Savings: ~140 tokens (31%)

At scale (100 specs/day, $3/M input tokens with Haiku): ~$0.04/day savings. The real value is in output token reduction — LLMs generate fewer tokens in YAML format, which reduces latency.

**Key rules:**
- Use YAML for standalone mode — it reduces both input and output tokens by ~30%
- Use JSON for inline mode / streaming — JSON Patch (RFC 6902) operates on JSON, not YAML
- Import `parseYamlSpec` from `@json-render/yaml` to convert YAML strings to spec objects
- Do not mix formats in a single spec — pick one and stay consistent
- Measure token usage with your provider's tokenizer to validate savings for your specific catalogs

Reference: https://github.com/nicholasgriffintn/json-render
