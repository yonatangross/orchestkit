---
name: skill-analyzer
description: Reference patterns for parsing skill metadata. Use when extracting phases, examples, or features from SKILL.md files for demo generation
context: inherit
version: 1.0.0
author: OrchestKit
tags: [skill, metadata, parser, analysis, reference]
user-invocable: false
---

# Skill Analyzer

Reference patterns for extracting structured metadata from SKILL.md files.

> **Note**: Actual analysis is performed by `demo-producer/scripts/generate.sh`. This skill provides reference patterns.

## Output Structure

```typescript
interface SkillMetadata {
  name: string;
  description: string;
  tags: string[];
  version: string;
  userInvocable: boolean;
  context: 'fork' | 'inherit' | 'none';

  // Extracted content
  phases: WorkflowPhase[];
  examples: CodeExample[];
  keyFeatures: string[];
  relatedSkills: string[];
}

interface WorkflowPhase {
  name: string;
  description: string;
  tools: string[];
  isParallel: boolean;
}

interface CodeExample {
  language: string;
  code: string;
  description: string;
}
```

## Extraction Rules

### Frontmatter Parsing (Bash)
```bash
# Extract name
name=$(grep "^name:" SKILL.md | head -1 | cut -d: -f2- | xargs)

# Extract description
description=$(grep "^description:" SKILL.md | head -1 | cut -d: -f2- | xargs)

# Extract tags
tags=$(grep "^tags:" SKILL.md | sed 's/tags: \[//' | sed 's/\]//' | tr -d '"')
```

### Phase Detection
- Look for `## Phase N:` or `### Phase N:` headers
- Extract tools from code blocks (Grep, Glob, Read, Task, etc.)
- Detect parallel execution from "PARALLEL" comments or multiple tool calls

### Example Detection
- Find code blocks with language tags
- Extract surrounding context as description
- Identify quick start examples

### Feature Detection
- Parse bullet points after "Key Features" or "What it does"
- Extract from description field
- Identify from tags

## Usage in Demo Pipeline

```bash
# Integrated into demo-producer
./skills/demo-producer/scripts/generate.sh skill explore

# Internally calls extraction functions to:
# 1. Parse SKILL.md frontmatter
# 2. Extract phases from ## headers
# 3. Identify related skills
# 4. Generate demo script with extracted content
```

## Related Skills

- `demo-producer`: Uses skill-analyzer output for script generation
- `terminal-demo-generator`: Creates recordings based on extracted phases
- `content-type-recipes`: Templates that consume analyzed metadata

## References

See `references/` for detailed extraction patterns:
- `frontmatter-parsing.md` - YAML frontmatter extraction
- `phase-extraction.md` - Workflow phase detection
