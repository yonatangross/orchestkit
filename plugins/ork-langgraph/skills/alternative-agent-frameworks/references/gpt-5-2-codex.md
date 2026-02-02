# GPT-5.2-Codex

OpenAI's specialized agentic coding model (January 2026) optimized for long-horizon software engineering tasks.

## Overview

GPT-5.2-Codex is a specialized variant of GPT-5.2 purpose-built for agentic coding workflows. Unlike the general-purpose GPT-5.2, Codex is optimized for:

- **Extended autonomous operation**: Hours-long coding sessions without degradation
- **Context compaction**: Intelligent summarization for long-running tasks
- **Project-scale understanding**: Full codebase comprehension and refactoring
- **Tool reliability**: Deterministic file operations and terminal commands

### Key Differences from GPT-5.2

| Capability | GPT-5.2 | GPT-5.2-Codex |
|------------|---------|---------------|
| Context Window | 256K tokens | 256K + compaction |
| Session Duration | Single request | Hours/days |
| Tool Execution | General | Code-optimized |
| File Operations | Basic | Atomic, rollback-aware |
| Terminal Access | Sandboxed | Full with safety rails |
| Vision | General | Code/diagram-aware |
| Cost per 1M tokens | $2.50/$10 | $5.00/$20 |

## Key Capabilities

### Long-Horizon Work Through Context Compaction

Codex automatically compacts context during extended sessions, preserving critical information while discarding ephemeral details.

```python
from openai import OpenAI

client = OpenAI()

# Codex maintains context across many tool calls
response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=[
        {"role": "system", "content": "You are a senior software engineer."},
        {"role": "user", "content": "Refactor the authentication module to use JWT."}
    ],
    # Codex-specific parameters
    extra_body={
        "codex_config": {
            "compaction_strategy": "semantic",  # semantic, aggressive, minimal
            "preserve_file_state": True,
            "max_session_hours": 8
        }
    }
)
```

**Compaction Strategies:**

| Strategy | Use Case | Retention |
|----------|----------|-----------|
| `semantic` | General development | Code structure, decisions, errors |
| `aggressive` | Very long tasks | Only current focus + critical history |
| `minimal` | Short tasks | Full context, no compaction |

### Project-Scale Tasks

Codex excels at large-scale operations that span entire codebases:

```python
from agents import Agent, tool

# Define codebase navigation tools
@tool
def search_codebase(query: str, file_types: list[str] = None) -> str:
    """Search across the entire codebase for patterns or definitions."""
    # Implementation
    pass

@tool
def apply_refactor(pattern: str, replacement: str, scope: str = "project") -> dict:
    """Apply a refactoring pattern across multiple files with preview."""
    # Returns affected files and changes for approval
    pass

codex_agent = Agent(
    name="refactor-engineer",
    model="gpt-5.2-codex",
    instructions="""You are a senior engineer performing large-scale refactors.

    Guidelines:
    1. Analyze impact before changes
    2. Create rollback points
    3. Run tests after each file change
    4. Document breaking changes""",
    tools=[search_codebase, apply_refactor]
)
```

**Supported Project Tasks:**

- Full codebase migrations (Python 2 to 3, React class to hooks)
- Dependency upgrades with breaking change resolution
- Architecture refactors (monolith to microservices)
- Test coverage expansion across modules
- Security vulnerability remediation

### Enhanced Cybersecurity Capabilities

Codex includes specialized training for security-aware coding:

```python
# Security-focused agent configuration
security_agent = Agent(
    name="security-engineer",
    model="gpt-5.2-codex",
    instructions="""You are a security engineer. When writing or reviewing code:

    1. Identify OWASP Top 10 vulnerabilities
    2. Check for secrets/credentials in code
    3. Validate input sanitization
    4. Review authentication/authorization flows
    5. Check dependency vulnerabilities via CVE databases""",
    extra_config={
        "security_mode": True,  # Enables security-focused reasoning
        "cve_lookup": True      # Real-time CVE database access
    }
)
```

**Security Capabilities:**

| Feature | Description |
|---------|-------------|
| Vulnerability Detection | SAST-like scanning during code review |
| CVE Awareness | Real-time vulnerability database lookups |
| Secrets Detection | Identifies hardcoded credentials, API keys |
| Threat Modeling | Suggests security improvements |
| Compliance Hints | GDPR, HIPAA, SOC2 pattern recognition |

### Vision for Code Artifacts

Codex processes visual inputs with code-aware understanding:

```python
import base64

# Process architecture diagram
with open("architecture.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode("utf-8")

response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "Implement the microservices shown in this architecture diagram."
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_data}"}
                }
            ]
        }
    ]
)
```

**Vision Use Cases:**

- Architecture diagrams to code scaffolding
- UI mockups to component implementation
- Error screenshots to debugging steps
- Whiteboard sketches to technical specs
- Database schemas (ERD) to migrations

### Benchmark Performance

GPT-5.2-Codex achieves state-of-the-art results on coding benchmarks:

| Benchmark | GPT-5.2 | GPT-5.2-Codex | Previous SOTA |
|-----------|---------|---------------|---------------|
| SWE-Bench Pro | 61.2% | 78.4% | 68.1% (Claude Opus 4.5) |
| Terminal-Bench 2.0 | 72.8% | 89.3% | 81.2% (Gemini 2.5) |
| HumanEval+ | 94.1% | 96.8% | 95.2% (GPT-5.2) |
| MBPP+ | 89.7% | 93.2% | 91.4% (Claude Opus 4.5) |
| CodeContests | 45.2% | 58.7% | 52.3% (Gemini 2.5) |

**SWE-Bench Pro Notes:**
- Tests real GitHub issues requiring multi-file changes
- Codex excels at test-writing and edge case handling
- Strong performance on legacy codebase understanding

**Terminal-Bench 2.0 Notes:**
- Tests long-horizon terminal tasks (setup, deploy, debug)
- Codex maintains coherent state across 50+ commands
- Superior error recovery and alternative path exploration

## API Usage Patterns

### Basic Completion

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=[
        {
            "role": "system",
            "content": "You are an expert Python developer."
        },
        {
            "role": "user",
            "content": "Write a connection pool manager with health checks."
        }
    ],
    temperature=0.2,  # Lower temperature for code generation
    max_tokens=4096
)

print(response.choices[0].message.content)
```

### Streaming with Tool Use

```python
import json

# Define tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read contents of a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write contents to a file",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path"},
                    "content": {"type": "string", "description": "File content"}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a shell command",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command to run"},
                    "timeout": {"type": "integer", "description": "Timeout in seconds"}
                },
                "required": ["command"]
            }
        }
    }
]

# Streaming with tool calls
stream = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=[
        {"role": "user", "content": "Set up a new FastAPI project with tests"}
    ],
    tools=tools,
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.tool_calls:
        tool_call = chunk.choices[0].delta.tool_calls[0]
        print(f"Tool: {tool_call.function.name}")
    elif chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")
```

### Async Operations

```python
import asyncio
from openai import AsyncOpenAI

async_client = AsyncOpenAI()

async def refactor_module(module_path: str) -> str:
    response = await async_client.chat.completions.create(
        model="gpt-5.2-codex",
        messages=[
            {
                "role": "system",
                "content": "Refactor code for readability and performance."
            },
            {
                "role": "user",
                "content": f"Refactor the module at {module_path}"
            }
        ],
        extra_body={
            "codex_config": {
                "preserve_behavior": True,
                "add_type_hints": True
            }
        }
    )
    return response.choices[0].message.content

# Parallel refactoring
async def refactor_project(modules: list[str]):
    tasks = [refactor_module(m) for m in modules]
    results = await asyncio.gather(*tasks)
    return dict(zip(modules, results))
```

## Integration with Agents SDK

GPT-5.2-Codex integrates seamlessly with OpenAI Agents SDK 0.6.x:

```python
from agents import Agent, Runner, handoff, tool
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

# File operation tools
@tool
def read_file(path: str) -> str:
    """Read file contents."""
    with open(path) as f:
        return f.read()

@tool
def write_file(path: str, content: str) -> str:
    """Write content to file."""
    with open(path, "w") as f:
        f.write(content)
    return f"Wrote {len(content)} bytes to {path}"

@tool
def run_tests(path: str = ".") -> str:
    """Run pytest on the specified path."""
    import subprocess
    result = subprocess.run(
        ["pytest", path, "-v", "--tb=short"],
        capture_output=True,
        text=True
    )
    return f"Exit code: {result.returncode}\n{result.stdout}\n{result.stderr}"

# Specialized agents using Codex
architect_agent = Agent(
    name="architect",
    model="gpt-5.2-codex",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a software architect. Analyze requirements and design solutions.
Hand off to implementer for coding tasks.
Hand off to reviewer for code review.""",
    tools=[read_file]
)

implementer_agent = Agent(
    name="implementer",
    model="gpt-5.2-codex",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a senior developer. Implement designs with clean, tested code.
Hand off to reviewer when implementation is complete.""",
    tools=[read_file, write_file, run_tests]
)

reviewer_agent = Agent(
    name="reviewer",
    model="gpt-5.2-codex",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are a code reviewer. Check for bugs, security issues, and style.
Request changes from implementer if needed.
Approve and hand back to architect when satisfied.""",
    tools=[read_file]
)

# Wire up handoffs
architect_agent.handoffs = [
    handoff(agent=implementer_agent),
    handoff(agent=reviewer_agent)
]
implementer_agent.handoffs = [
    handoff(agent=reviewer_agent),
    handoff(agent=architect_agent)
]
reviewer_agent.handoffs = [
    handoff(agent=implementer_agent),
    handoff(agent=architect_agent)
]

# Run development workflow
async def develop_feature(requirement: str):
    runner = Runner()
    result = await runner.run(
        architect_agent,
        f"Design and implement: {requirement}"
    )
    return result.final_output
```

### RealtimeRunner for Interactive Sessions

```python
from agents import Agent
from agents.realtime import RealtimeRunner

# Interactive coding session
codex_agent = Agent(
    name="pair-programmer",
    model="gpt-5.2-codex",
    instructions="You are a pair programming partner. Help write and debug code."
)

async def interactive_session():
    async with RealtimeRunner(codex_agent) as runner:
        # Continuous conversation with context preservation
        while True:
            user_input = input("> ")
            if user_input == "exit":
                break

            async for chunk in runner.stream(user_input):
                print(chunk.content, end="", flush=True)
            print()
```

## IDE Integrations

GPT-5.2-Codex powers several IDE integrations:

### Cursor

```json
// .cursor/settings.json
{
  "ai.model": "gpt-5.2-codex",
  "ai.features": {
    "composer": true,
    "agent": true,
    "codebaseIndexing": true
  },
  "ai.codex": {
    "sessionDuration": "8h",
    "compactionStrategy": "semantic"
  }
}
```

**Cursor Features with Codex:**
- Composer for multi-file generation
- Agent mode for autonomous tasks
- Background indexing for codebase awareness
- Inline completions with project context

### Windsurf (Codeium)

```yaml
# .windsurf/config.yaml
model:
  provider: openai
  name: gpt-5.2-codex

cascade:
  enabled: true
  max_depth: 10
  auto_apply: false  # Review changes before applying

features:
  flows: true        # Multi-step guided workflows
  supercomplete: true
  terminal_agent: true
```

**Windsurf Features:**
- Cascade for chained operations
- Flows for guided development
- Terminal integration for full-stack tasks

### GitHub Copilot Workspace

```yaml
# .github/copilot-workspace.yml
model: gpt-5.2-codex

workspace:
  scope: repository
  features:
    - issue-to-pr
    - multi-file-edit
    - test-generation

review:
  auto_suggest: true
  security_scan: true
```

**Copilot Workspace Features:**
- Issue-to-PR automation
- Multi-repository awareness
- Integrated CI feedback

### Factory (VSCode Extension)

```json
// .vscode/settings.json
{
  "factory.model": "gpt-5.2-codex",
  "factory.drafter": {
    "enabled": true,
    "autoContext": true
  },
  "factory.pilot": {
    "enabled": true,
    "approvalRequired": true
  }
}
```

## When to Use Codex vs Standard GPT-5.2

### Use GPT-5.2-Codex When:

| Scenario | Why Codex |
|----------|-----------|
| Multi-file refactors | Project-scale context management |
| Long debugging sessions | Context compaction prevents degradation |
| Security reviews | Specialized vulnerability detection |
| Test generation at scale | Understands test patterns across codebase |
| Architecture migrations | Maintains coherence across many changes |
| CI/CD pipeline work | Terminal-optimized tool execution |

### Use Standard GPT-5.2 When:

| Scenario | Why Standard |
|----------|--------------|
| Single-file tasks | No need for compaction overhead |
| Code explanation | General language understanding sufficient |
| Quick prototypes | Faster, cheaper for short tasks |
| Non-code tasks | Writing docs, emails, general Q&A |
| Cost-sensitive workloads | 50% cheaper than Codex |

### Decision Matrix

```
Task Duration > 1 hour?
  |
  +-- Yes --> GPT-5.2-Codex
  |
  +-- No
        |
        +-- Multiple files affected?
        |     |
        |     +-- Yes --> GPT-5.2-Codex
        |     |
        |     +-- No
        |           |
        |           +-- Security review needed?
        |           |     |
        |           |     +-- Yes --> GPT-5.2-Codex
        |           |     |
        |           |     +-- No --> GPT-5.2 (standard)
```

## Pricing Considerations

### Token Pricing (January 2026)

| Model | Input (per 1M) | Output (per 1M) | Cached Input |
|-------|----------------|-----------------|--------------|
| gpt-5.2 | $2.50 | $10.00 | $1.25 |
| gpt-5.2-codex | $5.00 | $20.00 | $2.50 |
| gpt-5.2-mini | $0.15 | $0.60 | $0.075 |

### Cost Optimization Strategies

```python
# 1. Use caching for repeated context
response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=messages,
    extra_body={
        "cache_control": {
            "system_prompt": "ephemeral",  # Cache system prompt
            "file_contents": "persistent"   # Cache file reads
        }
    }
)

# 2. Batch similar operations
# Instead of separate calls per file:
files_to_refactor = ["auth.py", "users.py", "api.py"]
response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=[
        {"role": "user", "content": f"Refactor these files: {files_to_refactor}"}
    ]
)

# 3. Use gpt-5.2-mini for preprocessing
# Filter/classify tasks before sending to Codex
classification = client.chat.completions.create(
    model="gpt-5.2-mini",
    messages=[{"role": "user", "content": f"Is this task complex? {task}"}]
)
if "complex" in classification.choices[0].message.content.lower():
    # Use Codex for complex tasks
    use_model = "gpt-5.2-codex"
else:
    # Use standard for simple tasks
    use_model = "gpt-5.2"
```

### Estimated Costs by Task Type

| Task | Est. Tokens | Codex Cost | Standard Cost |
|------|-------------|------------|---------------|
| Single file fix | ~5K | $0.12 | $0.06 |
| Module refactor | ~50K | $1.25 | $0.63 |
| Full codebase migration | ~500K | $12.50 | $6.25 |
| 8-hour dev session | ~2M | $50.00 | $25.00 |

**Note:** Codex typically requires fewer iterations for complex tasks, often making total cost comparable to standard GPT-5.2.

## Configuration Reference

### Codex-Specific Parameters

```python
response = client.chat.completions.create(
    model="gpt-5.2-codex",
    messages=messages,
    extra_body={
        "codex_config": {
            # Context management
            "compaction_strategy": "semantic",  # semantic, aggressive, minimal
            "preserve_file_state": True,        # Remember file contents
            "max_session_hours": 8,             # Session duration limit

            # Code behavior
            "preserve_behavior": True,          # Ensure refactors don't change behavior
            "add_type_hints": True,             # Add type hints when refactoring
            "follow_style_guide": "project",    # project, google, pep8

            # Safety
            "security_mode": True,              # Enable security scanning
            "dry_run": False,                   # Preview changes without applying
            "require_tests": True,              # Require test coverage for changes

            # Tools
            "shell_timeout": 300,               # Max seconds for shell commands
            "file_size_limit": 1048576          # Max file size to read (1MB)
        }
    }
)
```

## Best Practices

1. **Start with clear goals**: Define what "done" looks like upfront
2. **Provide project context**: Include README, architecture docs, coding standards
3. **Use semantic compaction**: Best balance of context and performance
4. **Enable security mode**: Catch vulnerabilities during development
5. **Set session limits**: Prevent runaway costs with `max_session_hours`
6. **Review before applying**: Use `dry_run` for large refactors
7. **Batch related operations**: Reduce API calls by grouping similar tasks
8. **Cache file contents**: Use persistent caching for frequently read files

## Related Resources

- [OpenAI Agents SDK Reference](openai-agents-sdk.md)
- [Framework Comparison](framework-comparison.md)
- [Multi-Agent Orchestration](../SKILL.md)
