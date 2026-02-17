---
title: Skill Analyzer Patterns
impact: MEDIUM
impactDescription: "Incorrect metadata extraction produces demos with wrong content — misrepresenting skill capabilities to users"
tags: skill, metadata, parser, extraction, frontmatter, demo
---

## Skill Analyzer Patterns

Reference patterns for extracting structured metadata from SKILL.md files for demo script generation.

### Output Structure

```typescript
interface SkillMetadata {
  name: string;
  description: string;
  tags: string[];
  version: string;
  userInvocable: boolean;
  context: 'fork' | 'inherit' | 'none';
  phases: WorkflowPhase[];
  examples: CodeExample[];
  keyFeatures: string[];
  relatedSkills: string[];
}
```

### Frontmatter Parsing

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

- Find code blocks with language tags (```python, ```bash, etc.)
- Extract surrounding context as description
- Identify quick start examples from `## Quick Start` sections

### Feature Detection

- Parse bullet points after "Key Features" or "What it does"
- Extract from description field
- Identify from tags array

### Key Rules

- Parse frontmatter YAML **before** the closing `---` delimiter
- Phase headers follow `## Phase N:` pattern — extract name and description
- Code examples need **language tag** and **surrounding context**
- Related skills come from `## Related Skills` section with backtick-wrapped names
- Validate extracted metadata against the `SkillMetadata` interface before generating demos

**Incorrect — Parsing description from wrong section:**
```bash
# Extracts from body instead of frontmatter
description=$(grep -m1 "description:" SKILL.md | cut -d: -f2-)
# Gets "Description of feature X" from body, not skill description
```

**Correct — Extracting from frontmatter only:**
```bash
# Extract frontmatter between --- delimiters
frontmatter=$(sed -n '/^---$/,/^---$/p' SKILL.md | sed '1d;$d')
description=$(echo "$frontmatter" | grep "^description:" | cut -d: -f2- | xargs)
```
