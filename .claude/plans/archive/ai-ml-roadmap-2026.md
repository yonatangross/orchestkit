# AI/ML Roadmap 2026 Implementation Plan

**Created**: 2026-01-18
**Issues**: #72, #73, #74, #75, #76, #77, #78, #79, #148, #150

---

## Executive Summary

This plan implements 10 AI/ML roadmap items spanning guardrails, agentic RAG, MCP security, alternative frameworks, prompt engineering, inference optimization, and fine-tuning. Based on comprehensive research using Context7 and web search, this plan incorporates January 2026 best practices.

**Total Deliverables**:
- 10 new skills (following CC 2.1.7 flat structure)
- 2 new agents (CC 2.1.6 native format)
- Estimated tokens per skill: 500-800 (SKILL.md) + 200-400 (references)

---

## Implementation Priority Order

| Priority | Issue | Topic | Dependencies |
|----------|-------|-------|--------------|
| 🔴 CRITICAL | #74 | MCP Security Hardening | None |
| 🔴 CRITICAL | #72 | Advanced Guardrails & Safety | None |
| 🔴 CRITICAL | #73 | Agentic RAG Patterns | Existing langgraph-* skills |
| 🟡 HIGH | #148 | Agent: ai-safety-auditor | #72, #74 |
| 🟠 MEDIUM | #76 | Prompt Engineering Suite | None |
| 🟠 MEDIUM | #150 | Agent: prompt-engineer | #76 |
| 🟠 MEDIUM | #75 | Alternative Agent Frameworks | None |
| 🟠 MEDIUM | #77 | MCP Advanced Patterns | #74 |
| 🟠 MEDIUM | #78 | High-Performance Inference | None |
| 🟢 LOW | #79 | Fine-Tuning & Customization | #78 |

---

## Phase 1: Critical Security & Safety (Week 1-2)

### 1.1 Skill: `mcp-security-hardening` (#74)

**Directory Structure**:
```
skills/mcp-security-hardening/
├── SKILL.md                        # ~600 tokens
├── references/
│   ├── prompt-injection-defense.md # ~250 tokens
│   ├── tool-poisoning-attacks.md   # ~200 tokens
│   └── tool-permissions.md         # ~200 tokens
└── checklists/
    └── mcp-security-audit.md       # ~150 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: mcp-security-hardening
description: MCP security patterns for prompt injection defense, tool poisoning prevention, and permission management. Use when securing MCP servers, validating tool descriptions, implementing allowlists.
version: 1.0.0
tags: [mcp, security, prompt-injection, tool-poisoning, allowlist, 2026]
context: fork
---
```

**Key Patterns** (from research):
1. **Request Sanitization** - First line of defense with strict templates
2. **Response Filtering** - Remove instruction-like phrases from outputs
3. **Tool Description Sanitization** - Treat all tool descriptions as untrusted
4. **Capability Declarations** - Limit what servers can request
5. **Zero-Trust Allowlists** - Mandatory vetting per Agentforce model
6. **Human-in-the-Loop** - Required for sensitive tool invocations
7. **Session Security** - Secure non-deterministic session IDs

**Code Examples to Include**:
```python
# Tool description sanitization
def sanitize_tool_description(description: str) -> str:
    """Remove potential injection patterns from tool descriptions."""
    forbidden_patterns = [
        r"ignore previous",
        r"system prompt",
        r"<.*instruction.*>",
        r"IMPORTANT:",
    ]
    sanitized = description
    for pattern in forbidden_patterns:
        sanitized = re.sub(pattern, "[REDACTED]", sanitized, flags=re.I)
    return sanitized

# Allowlist-based tool validation
class MCPToolValidator:
    def __init__(self, allowlist: set[str]):
        self.allowlist = allowlist

    def validate(self, tool_name: str, tool_hash: str) -> bool:
        """Validate tool against allowlist with hash verification."""
        return (tool_name, tool_hash) in self.allowlist
```

**Sources**:
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [Pillar Security - MCP Risks](https://www.pillar.security/blog/the-security-risks-of-model-context-protocol-mcp)
- [Agentforce Enterprise Governance](https://www.startuphub.ai/ai-news/ai-research/2026/securing-the-model-context-protocol-agentforce-adds-enterprise-governance/)

---

### 1.2 Skill: `advanced-guardrails` (#72)

**Directory Structure**:
```
skills/advanced-guardrails/
├── SKILL.md                        # ~700 tokens
├── references/
│   ├── nemo-guardrails.md          # ~300 tokens
│   ├── guardrails-ai.md            # ~250 tokens
│   ├── openai-guardrails.md        # ~200 tokens
│   ├── factuality-checking.md      # ~200 tokens
│   └── red-teaming.md              # ~250 tokens
└── templates/
    ├── nemo-config.yaml            # ~150 tokens
    └── rails-pipeline.py           # ~200 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: advanced-guardrails
description: LLM guardrails with NeMo, Guardrails AI, and OpenAI. Input/output rails, hallucination prevention, fact-checking, toxicity detection, topical enforcement.
version: 1.0.0
tags: [guardrails, nemo, safety, hallucination, factuality, rails, 2026]
context: fork
agent: ai-safety-auditor
---
```

**Key Patterns** (from NeMo Guardrails Context7):
1. **Input Rails** - PII detection, competitor mentions, topic enforcement
2. **Output Rails** - Toxicity filtering, length validation, topic restriction
3. **Hallucination Rails** - Blocking mode with `$check_hallucination = True`
4. **Fact-Checking Rails** - RAG integration with `$check_facts = True`
5. **Colang Flows** - Custom dialog management with NeMo

**NeMo Configuration Template**:
```yaml
models:
  - type: main
    engine: openai
    model: gpt-4o

rails:
  config:
    guardrails_ai:
      validators:
        - name: toxic_language
          parameters:
            threshold: 0.5
            validation_method: "sentence"
        - name: guardrails_pii
          parameters:
            entities: ["phone_number", "email", "ssn"]
        - name: restricttotopic
          parameters:
            valid_topics: ["technology", "support"]

  input:
    flows:
      - guardrailsai check input $validator="guardrails_pii"

  output:
    flows:
      - guardrailsai check output $validator="toxic_language"
      - guardrailsai check output $validator="restricttotopic"
```

**Red Teaming Patterns** (from OWASP/DeepTeam research):
```python
from deepteam import red_team
from deepteam.vulnerabilities import (
    Bias, Toxicity, PIILeakage,
    PromptInjection, Jailbreaking
)

# Automated red teaming with DeepTeam
results = red_team(
    model=target_llm,
    vulnerabilities=[
        Bias(),
        Toxicity(),
        PIILeakage(),
        PromptInjection(),
        Jailbreaking(multi_turn=True),  # GOAT-style attacks
    ],
    attacks_per_vulnerability=10,
)
```

**Sources**:
- [NeMo Guardrails Docs](https://github.com/nvidia/nemo-guardrails)
- [OWASP Gen AI Security](https://genai.owasp.org/)
- [DeepTeam Red Teaming](https://github.com/confident-ai/deepteam)
- [Confident AI Red Teaming Guide](https://www.confident-ai.com/blog/red-teaming-llms-a-step-by-step-guide)

---

### 1.3 Skill: `agentic-rag-patterns` (#73)

**Directory Structure**:
```
skills/agentic-rag-patterns/
├── SKILL.md                        # ~700 tokens
├── references/
│   ├── self-rag.md                 # ~300 tokens
│   ├── corrective-rag.md           # ~300 tokens
│   ├── knowledge-graph-rag.md      # ~250 tokens
│   └── adaptive-retrieval.md       # ~200 tokens
└── templates/
    ├── self-rag-graph.py           # ~250 tokens
    └── crag-workflow.py            # ~250 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: agentic-rag-patterns
description: Advanced RAG with Self-RAG, Corrective-RAG, and knowledge graphs. Adaptive retrieval, document grading, query rewriting, web fallback. Use when building self-correcting retrieval systems.
version: 1.0.0
tags: [rag, self-rag, crag, knowledge-graph, langgraph, agentic, 2026]
context: fork
---
```

**Key Patterns** (from LangGraph Context7):
1. **Self-RAG Nodes**: retrieve → grade_documents → generate → transform_query
2. **Corrective-RAG Agents**: Context Retrieval, Relevance Evaluation, Query Refinement, External Knowledge, Response Synthesis
3. **Document Grading**: Binary relevance scoring before generation
4. **Query Transformation**: Rewrite for better retrieval
5. **Web Fallback**: Tavily search when documents insufficient

**Self-RAG LangGraph Implementation**:
```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, List

class RAGState(TypedDict):
    question: str
    documents: List[Document]
    generation: str
    web_search_needed: bool

def grade_documents(state: RAGState) -> dict:
    """Grade documents for relevance."""
    question = state["question"]
    documents = state["documents"]

    filtered_docs = []
    for doc in documents:
        score = retrieval_grader.invoke({
            "question": question,
            "document": doc.page_content
        })
        if score.binary_score == "yes":
            filtered_docs.append(doc)

    web_search_needed = len(filtered_docs) < len(documents) // 2
    return {
        "documents": filtered_docs,
        "web_search_needed": web_search_needed
    }

# Build graph
workflow = StateGraph(RAGState)
workflow.add_node("retrieve", retrieve)
workflow.add_node("grade", grade_documents)
workflow.add_node("generate", generate)
workflow.add_node("web_search", web_search)
workflow.add_node("transform_query", transform_query)

workflow.add_edge(START, "retrieve")
workflow.add_edge("retrieve", "grade")
workflow.add_conditional_edges(
    "grade",
    lambda x: "web_search" if x["web_search_needed"] else "generate",
)
workflow.add_edge("web_search", "generate")
workflow.add_edge("generate", END)

graph = workflow.compile()
```

**Sources**:
- [LangGraph Self-RAG Example](https://github.com/langchain-ai/langgraph/blob/main/examples/rag/langgraph_self_rag_pinecone_movies.ipynb)
- [LangGraph CRAG Example](https://github.com/langchain-ai/langgraph/blob/main/examples/rag/langgraph_crag.ipynb)
- [Agentic RAG Survey](https://arxiv.org/abs/2501.09136)

---

## Phase 2: Agents & Prompt Engineering (Week 3-4)

### 2.1 Agent: `ai-safety-auditor` (#148)

**File**: `agents/ai-safety-auditor.md`

```yaml
---
name: ai-safety-auditor
description: AI safety and security auditor for LLM systems. Red teaming, guardrail validation, prompt injection testing, OWASP LLM compliance. Use for safety, security, audit, red-team, guardrails.
model: opus
color: red
tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - WebFetch
skills:
  - advanced-guardrails
  - mcp-security-hardening
  - llm-safety-patterns
  - owasp-top-10
  - security-scanning
---

## Directive
You are an AI Safety Auditor specializing in LLM security assessment. Your mission is to identify vulnerabilities, test guardrails, and ensure compliance with safety standards.

## MCP Tools
- `mcp__mem0__*` - Store audit findings and patterns
- `mcp__memory__*` - Track security decisions in knowledge graph

## Concrete Objectives
1. Conduct systematic red teaming of LLM endpoints
2. Validate guardrail configurations (NeMo, Guardrails AI)
3. Test for prompt injection vulnerabilities
4. Assess OWASP LLM Top 10 compliance
5. Generate security audit reports with remediation steps

## Audit Framework

### Phase 1: Reconnaissance
- Identify all LLM endpoints and MCP servers
- Map tool permissions and capabilities
- Document input/output flows

### Phase 2: Vulnerability Assessment
| Category | Tests |
|----------|-------|
| Prompt Injection | Direct, indirect, multi-turn, encoded |
| Jailbreaking | GOAT, DAN, roleplay, context manipulation |
| Data Leakage | PII extraction, training data, system prompts |
| Guardrail Bypass | Encoding tricks, language switching, gradual escalation |

### Phase 3: Compliance Check
- [ ] OWASP LLM Top 10 2025 coverage
- [ ] NIST AI RMF alignment
- [ ] EU AI Act requirements (if applicable)

## Output Format
```json
{
  "audit_id": "uuid",
  "timestamp": "ISO-8601",
  "scope": ["endpoints audited"],
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "category": "OWASP category",
      "description": "...",
      "evidence": "...",
      "remediation": "..."
    }
  ],
  "compliance_score": 0-100,
  "recommendations": ["prioritized list"]
}
```

## Task Boundaries
**DO:** Security audits, red teaming, guardrail testing, compliance checks
**DON'T:** Feature development, general code review, performance optimization
```

---

### 2.2 Skill: `prompt-engineering-suite` (#76)

**Directory Structure**:
```
skills/prompt-engineering-suite/
├── SKILL.md                        # ~600 tokens
├── references/
│   ├── chain-of-thought.md         # ~250 tokens
│   ├── few-shot-patterns.md        # ~250 tokens
│   ├── prompt-versioning.md        # ~200 tokens
│   └── prompt-optimization.md      # ~200 tokens
└── templates/
    ├── cot-template.py             # ~150 tokens
    └── few-shot-template.py        # ~150 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: prompt-engineering-suite
description: Comprehensive prompt engineering with Chain-of-Thought, few-shot learning, prompt versioning, and optimization. Use when designing prompts, improving accuracy, managing prompt lifecycle.
version: 1.0.0
tags: [prompts, cot, few-shot, versioning, optimization, 2026]
context: fork
agent: prompt-engineer
---
```

**Key Patterns**:
1. **Chain-of-Thought (CoT)** - "Let's think step by step" + structured reasoning
2. **Few-Shot Learning** - Example selection, formatting, ordering
3. **Prompt Templates** - Variables for maintainability (per OpenAI guidance)
4. **Version Control** - Langfuse prompt management, A/B testing
5. **Optimization** - DSPy-style automatic optimization

**CoT Implementation**:
```python
from langchain_core.prompts import ChatPromptTemplate

COT_SYSTEM = """You are a helpful assistant. When solving problems:
1. Break down the problem into steps
2. Show your reasoning for each step
3. Verify your answer before responding
4. If uncertain, acknowledge limitations"""

COT_USER = """Problem: {problem}

Think through this step-by-step:
Step 1:"""

cot_prompt = ChatPromptTemplate.from_messages([
    ("system", COT_SYSTEM),
    ("human", COT_USER),
])
```

**Prompt Versioning with Langfuse**:
```python
from langfuse import Langfuse

langfuse = Langfuse()

# Retrieve versioned prompt
prompt = langfuse.get_prompt(
    name="customer-support-v2",
    version=3,  # Specific version
    cache_ttl_seconds=300,
)

# A/B testing with rollout
prompt = langfuse.get_prompt(
    name="customer-support",
    label="production",  # 50% rollout
)
```

---

### 2.3 Agent: `prompt-engineer` (#150)

**File**: `agents/prompt-engineer.md`

```yaml
---
name: prompt-engineer
description: Expert prompt designer and optimizer. Chain-of-thought, few-shot, prompt versioning, A/B testing, optimization. Use for prompts, prompt-engineering, cot, few-shot.
model: sonnet
color: purple
tools:
  - Read
  - Write
  - Bash
  - WebFetch
skills:
  - prompt-engineering-suite
  - llm-evaluation
  - langfuse-observability
  - context-engineering
---

## Directive
You are a Prompt Engineer specializing in designing, testing, and optimizing prompts for LLM applications. Your goal is to maximize accuracy, reliability, and cost-efficiency.

## Concrete Objectives
1. Design prompts using proven patterns (CoT, few-shot, structured)
2. Implement prompt versioning and management
3. Set up A/B testing for prompt variations
4. Optimize prompts for cost and latency
5. Measure and improve prompt effectiveness

## Prompt Design Framework

### Step 1: Requirements Analysis
- What task does the prompt accomplish?
- What is the expected input format?
- What is the desired output format?
- What edge cases must be handled?

### Step 2: Pattern Selection
| Pattern | When to Use |
|---------|-------------|
| Zero-shot | Simple, well-defined tasks |
| Few-shot | Complex tasks needing examples |
| CoT | Reasoning, math, logic problems |
| ReAct | Tool use, multi-step actions |
| Structured | JSON/schema output required |

### Step 3: Iteration & Testing
1. Write initial prompt
2. Test with diverse inputs
3. Identify failure modes
4. Refine and version

## Output Format
```markdown
## Prompt: {name}
**Version**: v{X.Y.Z}
**Pattern**: {CoT|few-shot|zero-shot|ReAct}
**Model**: {recommended model}

### System Prompt
```
{system prompt content}
```

### User Prompt Template
```
{user prompt with {variables}}
```

### Example I/O
Input: ...
Output: ...

### Known Limitations
- ...
```

## Task Boundaries
**DO:** Prompt design, optimization, versioning, A/B testing
**DON'T:** Model fine-tuning, infrastructure, general coding
```

---

## Phase 3: Framework Skills (Week 5-6)

### 3.1 Skill: `alternative-agent-frameworks` (#75)

**Directory Structure**:
```
skills/alternative-agent-frameworks/
├── SKILL.md                        # ~700 tokens
├── references/
│   ├── crewai-patterns.md          # ~300 tokens
│   ├── autogen-ag2.md              # ~300 tokens
│   ├── openai-agents-sdk.md        # ~300 tokens
│   └── framework-comparison.md     # ~200 tokens
└── templates/
    ├── crewai-crew.py              # ~200 tokens
    └── openai-multi-agent.py       # ~200 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: alternative-agent-frameworks
description: Multi-agent frameworks beyond LangGraph. CrewAI crews, Microsoft Agent Framework (AutoGen successor), OpenAI Agents SDK. Use when building multi-agent systems, choosing frameworks.
version: 1.0.0
tags: [crewai, autogen, ag2, openai-agents, multi-agent, orchestration, 2026]
context: fork
---
```

**Framework Comparison Table**:
| Framework | Best For | Key Features | 2026 Status |
|-----------|----------|--------------|-------------|
| **LangGraph** | Complex stateful workflows | Persistence, streaming, human-in-loop | Production |
| **CrewAI** | Role-based collaboration | Hierarchical crews, memory, delegation | Production |
| **OpenAI Agents SDK** | OpenAI ecosystem | Handoffs, guardrails, tracing | Production |
| **Microsoft Agent Framework** | Enterprise | AutoGen+SK merger, compliance, A2A | GA Q1 2026 |
| **AG2** | Open-source, flexible | Community fork of AutoGen | Active |

**CrewAI Hierarchical Crew** (from Context7):
```python
from crewai import Agent, Crew, Task, Process

manager = Agent(
    role="Project Manager",
    goal="Coordinate team and ensure quality",
    allow_delegation=True,
    memory=True,
)

researcher = Agent(
    role="Researcher",
    goal="Provide accurate analysis",
    allow_delegation=False,
)

crew = Crew(
    agents=[manager, researcher],
    tasks=[research_task, analysis_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",
    memory=True,
)

result = crew.kickoff()
```

**OpenAI Agents SDK** (from research):
```python
from openai_agents import Agent, Crew

# Agents-as-tools pattern
@agent
def researcher(query: str) -> str:
    """Research agent for gathering information."""
    return research_chain.invoke(query)

@agent
def writer(context: str, topic: str) -> str:
    """Writer agent for content creation."""
    return writing_chain.invoke({"context": context, "topic": topic})

# Orchestrator calls agents as tools
orchestrator = Agent(
    name="orchestrator",
    tools=[researcher, writer],
    handoffs=["researcher", "writer"],
)
```

**Sources**:
- [CrewAI Documentation](https://github.com/crewaiinc/crewai)
- [OpenAI Agents SDK Multi-Agent](https://openai.github.io/openai-agents-python/multi_agent/)
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)

---

### 3.2 Skill: `mcp-advanced-patterns` (#77)

**Directory Structure**:
```
skills/mcp-advanced-patterns/
├── SKILL.md                        # ~600 tokens
├── references/
│   ├── tool-composition.md         # ~250 tokens
│   ├── resource-management.md      # ~250 tokens
│   ├── scaling-strategies.md       # ~200 tokens
│   └── server-building.md          # ~200 tokens
└── templates/
    └── mcp-server-template.py      # ~250 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: mcp-advanced-patterns
description: Advanced MCP patterns for tool composition, resource management, and scaling. Build custom MCP servers, compose tools, manage resources efficiently.
version: 1.0.0
tags: [mcp, tools, resources, scaling, servers, 2026]
context: fork
---
```

**Key Patterns**:
1. **Tool Composition** - Combining tools into higher-level operations
2. **Resource Management** - Efficient handling of MCP resources
3. **Server Scaling** - Horizontal scaling with load balancing
4. **Custom Servers** - Building domain-specific MCP servers
5. **Auto-Enable Thresholds** - `auto:N` syntax for context management

---

## Phase 4: Performance & Optimization (Week 7-8)

### 4.1 Skill: `high-performance-inference` (#78)

**Directory Structure**:
```
skills/high-performance-inference/
├── SKILL.md                        # ~700 tokens
├── references/
│   ├── vllm-deployment.md          # ~300 tokens
│   ├── quantization-guide.md       # ~300 tokens
│   ├── speculative-decoding.md     # ~200 tokens
│   └── edge-deployment.md          # ~200 tokens
└── templates/
    ├── vllm-server.py              # ~150 tokens
    └── quantization-config.py      # ~150 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: high-performance-inference
description: High-performance LLM inference with vLLM, quantization (AWQ, GPTQ, FP8), speculative decoding, and edge deployment. Use when optimizing inference latency, throughput, or memory.
version: 1.0.0
tags: [vllm, quantization, inference, performance, edge, 2026]
context: fork
---
```

**vLLM Key Features** (from Context7):
- **PagedAttention** - Efficient KV cache management
- **Continuous Batching** - Dynamic request batching
- **Quantization** - GPTQ, AWQ, INT4, INT8, FP8
- **Speculative Decoding** - Draft model acceleration
- **CUDA Graphs** - Fast model execution

**vLLM Deployment**:
```bash
# Start vLLM server with quantization + speculative decoding
vllm serve meta-llama/Meta-Llama-3.1-70B-Instruct \
    --quantization awq \
    --speculative-config '{"method": "ngram", "num_speculative_tokens": 5}' \
    --tensor-parallel-size 4 \
    --max-model-len 8192
```

**Quantization with GPTQModel**:
```python
from gptqmodel import GPTQModel, QuantizeConfig
from datasets import load_dataset

calibration_data = load_dataset(
    "allenai/c4",
    data_files="en/c4-train.00001-of-01024.json.gz",
    split="train",
).select(range(1024))["text"]

quant_config = QuantizeConfig(bits=4, group_size=128)
model = GPTQModel.load("meta-llama/Llama-3.2-1B-Instruct", quant_config)
model.quantize(calibration_data, batch_size=4)
model.save("Llama-3.2-1B-Instruct-gptq-4bit")
```

**Sources**:
- [vLLM Documentation](https://github.com/vllm-project/vllm)
- [LLM Compressor](https://github.com/vllm-project/llm-compressor)

---

### 4.2 Skill: `fine-tuning-customization` (#79)

**Directory Structure**:
```
skills/fine-tuning-customization/
├── SKILL.md                        # ~700 tokens
├── references/
│   ├── lora-qlora.md               # ~300 tokens
│   ├── dpo-alignment.md            # ~250 tokens
│   ├── synthetic-data.md           # ~300 tokens
│   └── when-to-finetune.md         # ~150 tokens
└── templates/
    ├── lora-config.yaml            # ~100 tokens
    └── dpo-training.py             # ~200 tokens
```

**SKILL.md Frontmatter**:
```yaml
---
name: fine-tuning-customization
description: LLM fine-tuning with LoRA, QLoRA, DPO alignment, and synthetic data generation. Efficient training, preference learning, data creation. Use when customizing models for specific domains.
version: 1.0.0
tags: [fine-tuning, lora, qlora, dpo, synthetic-data, rlhf, 2026]
context: fork
---
```

**When to Fine-Tune** (from research):
1. Prompt engineering insufficient
2. RAG doesn't capture domain nuances
3. Specific output format required
4. Consistent persona/style needed
5. ~1000+ high-quality examples available

**LoRA vs QLoRA Decision**:
| Criteria | LoRA | QLoRA |
|----------|------|-------|
| Model fits in VRAM | ✅ Use LoRA | |
| Memory constrained | | ✅ Use QLoRA |
| Training speed priority | ✅ 39% faster | |
| Memory savings priority | | ✅ 33% less memory |

**Recommended Hyperparameters** (from Unsloth):
```yaml
# LoRA/QLoRA config
learning_rate: 2e-4  # Start here
epochs: 1-3  # More risks overfitting
lora_r: 16-64  # Rank (higher = more capacity)
lora_alpha: 32-128  # Scaling factor
target_modules:
  - q_proj
  - k_proj
  - v_proj
  - o_proj
  - gate_proj
  - up_proj
  - down_proj  # Include MLP layers per QLoRA paper
```

**DPO Alignment**:
```python
from trl import DPOTrainer, DPOConfig

config = DPOConfig(
    learning_rate=5e-6,  # Lower for alignment
    beta=0.1,  # KL penalty coefficient
    max_length=1024,
    max_prompt_length=512,
)

trainer = DPOTrainer(
    model=model,
    ref_model=ref_model,
    args=config,
    train_dataset=preference_dataset,
    tokenizer=tokenizer,
)

trainer.train()
```

**Synthetic Data Best Practices**:
1. **Teacher-Student**: Use stronger model to generate training data
2. **Iterative Generation**: Refine based on student model state
3. **Diversity**: Use multiple sources to prevent distribution collapse
4. **Quality > Quantity**: ~1000 high-quality examples often sufficient

**Sources**:
- [Unsloth Fine-Tuning Guide](https://docs.unsloth.ai/get-started/fine-tuning-llms-guide)
- [Databricks LoRA Guide](https://www.databricks.com/blog/efficient-fine-tuning-lora-guide-llms)
- [OpenRLHF Framework](https://github.com/OpenRLHF/OpenRLHF)

---

## Validation Checklist

### Per-Skill Validation
- [ ] SKILL.md has valid frontmatter (name, description, version, tags)
- [ ] Token count within budget (SKILL.md ~500-800 tokens)
- [ ] References exist and are <300 tokens each
- [ ] Code examples are production-ready with imports
- [ ] Related skills are cross-referenced
- [ ] 2026 versions/best practices included

### Agent Validation
- [ ] CC 2.1.6 native frontmatter format
- [ ] Skills array includes all required skills
- [ ] Activation keywords in description field
- [ ] Model selection appropriate (opus for critical, sonnet for standard)
- [ ] Task boundaries clearly defined
- [ ] Output format specified

### Integration Testing
- [ ] Skills load correctly via progressive loading
- [ ] Agents spawn with injected skills
- [ ] Cross-skill references resolve
- [ ] No circular dependencies

---

## Estimated Token Budgets

| Skill | SKILL.md | References | Templates | Total |
|-------|----------|------------|-----------|-------|
| mcp-security-hardening | 600 | 650 | 150 | 1400 |
| advanced-guardrails | 700 | 1200 | 350 | 2250 |
| agentic-rag-patterns | 700 | 1050 | 500 | 2250 |
| prompt-engineering-suite | 600 | 900 | 300 | 1800 |
| alternative-agent-frameworks | 700 | 1100 | 400 | 2200 |
| mcp-advanced-patterns | 600 | 900 | 250 | 1750 |
| high-performance-inference | 700 | 1000 | 300 | 2000 |
| fine-tuning-customization | 700 | 1000 | 300 | 2000 |
| **Total Skills** | 5300 | 7800 | 2550 | **15650** |

| Agent | Tokens |
|-------|--------|
| ai-safety-auditor | ~800 |
| prompt-engineer | ~600 |
| **Total Agents** | **1400** |

**Grand Total**: ~17,050 tokens of new content

---

## Implementation Order

```
Week 1-2 (Critical):
  ├── mcp-security-hardening (#74)
  ├── advanced-guardrails (#72)
  └── agentic-rag-patterns (#73)

Week 3-4 (Agents & Prompts):
  ├── ai-safety-auditor agent (#148)
  ├── prompt-engineering-suite (#76)
  └── prompt-engineer agent (#150)

Week 5-6 (Frameworks):
  ├── alternative-agent-frameworks (#75)
  └── mcp-advanced-patterns (#77)

Week 7-8 (Performance):
  ├── high-performance-inference (#78)
  └── fine-tuning-customization (#79)
```

---

## Sources & References

### Security & Safety
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [OWASP Gen AI Security](https://genai.owasp.org/)
- [Practical DevSecOps - MCP Vulnerabilities](https://www.practical-devsecops.com/mcp-security-vulnerabilities/)
- [DeepTeam Red Teaming](https://github.com/confident-ai/deepteam)

### Guardrails & RAG
- [NeMo Guardrails](https://github.com/nvidia/nemo-guardrails)
- [LangGraph Self-RAG](https://github.com/langchain-ai/langgraph/blob/main/examples/rag/)
- [Agentic RAG Survey](https://arxiv.org/abs/2501.09136)

### Frameworks
- [CrewAI](https://github.com/crewaiinc/crewai)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/agent-framework/)
- [AG2](https://github.com/ag2ai/ag2)

### Performance
- [vLLM](https://github.com/vllm-project/vllm)
- [Unsloth Fine-Tuning](https://docs.unsloth.ai/)
- [OpenRLHF](https://github.com/OpenRLHF/OpenRLHF)

---

**Plan Version**: 1.0.0
**Last Updated**: 2026-01-18
