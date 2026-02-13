# Framework Integrations

Langfuse v3 integrates with modern AI frameworks via OpenTelemetry. Each integration provides automatic tracing of agent execution, tool calls, and LLM generations.

## Claude Agent SDK

```python
# pip install anthropic langfuse
from langfuse import observe, get_client

@observe(type="agent", name="claude_agent")
async def run_claude_agent(task: str):
    """Claude Agent SDK with Langfuse tracing."""
    import anthropic

    client = anthropic.Anthropic()

    # Claude Agent SDK traces automatically via OTEL
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        tools=[
            {
                "name": "read_file",
                "description": "Read a file from disk",
                "input_schema": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            }
        ],
        messages=[{"role": "user", "content": task}],
    )

    get_client().update_current_observation(
        model="claude-sonnet-4-5-20250929",
        usage={
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    )
    return response


# Setup: Configure OTEL exporter to Langfuse
# LANGFUSE_PUBLIC_KEY=pk-... LANGFUSE_SECRET_KEY=sk-... python app.py
```

### Trace Output

```
claude_agent (agent, 4.2s, $0.08)
├── messages.create (generation, 3.8s)
│   ├── tool_use: read_file(path="src/main.py")
│   ├── tool_result: "def main():..."
│   └── assistant: "The code has..."
└── metadata: {model: claude-sonnet-4-5, tokens: 2500}
```

## OpenAI Agents SDK

```python
# pip install openai-agents langfuse
from langfuse import observe, get_client

@observe(type="agent", name="openai_agents_workflow")
async def run_openai_agents(query: str):
    """OpenAI Agents SDK with Langfuse tracing via OTEL."""
    from agents import Agent, Runner, function_tool

    @function_tool
    def search_docs(query: str) -> str:
        """Search documentation."""
        return f"Results for: {query}"

    agent = Agent(
        name="research_agent",
        instructions="You are a research assistant.",
        model="gpt-5.2",
        tools=[search_docs],
    )

    # Runner automatically exports traces to Langfuse via OTEL
    result = await Runner.run(agent, query)

    get_client().update_current_observation(
        output=result.final_output,
        metadata={"agent": "research_agent", "model": "gpt-5.2"},
    )
    return result.final_output
```

### Setup

```bash
# OpenAI Agents SDK uses OTEL for tracing
export OTEL_EXPORTER_OTLP_ENDPOINT="https://cloud.langfuse.com/api/public/otel"
export OTEL_EXPORTER_OTLP_HEADERS="x-langfuse-public-key=pk-...,x-langfuse-secret-key=sk-..."
```

## Pydantic AI

```python
# pip install pydantic-ai langfuse
from langfuse import observe, get_client

@observe(type="agent", name="pydantic_ai_agent")
async def run_pydantic_agent(query: str):
    """Pydantic AI agent with Langfuse tracing."""
    from pydantic_ai import Agent
    from pydantic import BaseModel

    class AnalysisResult(BaseModel):
        summary: str
        risk_level: str
        recommendations: list[str]

    agent = Agent(
        "claude-sonnet-4-5-20250929",
        result_type=AnalysisResult,
        system_prompt="You are a security analyst.",
    )

    # Pydantic AI supports Langfuse via instrument() or OTEL
    result = await agent.run(query)

    get_client().update_current_observation(
        output=result.data.model_dump(),
        metadata={"risk_level": result.data.risk_level},
    )
    return result.data


# Setup: Use Pydantic AI's built-in Langfuse instrumentation
# from pydantic_ai.integrations.langfuse import LangfuseInstrumentation
# LangfuseInstrumentation().instrument()
```

## CrewAI

```python
# pip install crewai langfuse
from langfuse import observe, get_client

@observe(type="agent", name="crewai_workflow")
async def run_crew(task_description: str):
    """CrewAI crew with Langfuse tracing."""
    from crewai import Crew, Agent, Task

    researcher = Agent(
        role="Senior Researcher",
        goal="Find comprehensive information",
        backstory="Expert researcher with 10 years experience",
        llm="claude-sonnet-4-5-20250929",
    )

    writer = Agent(
        role="Technical Writer",
        goal="Create clear documentation",
        backstory="Technical writer specializing in developer docs",
        llm="claude-sonnet-4-5-20250929",
    )

    research_task = Task(
        description=f"Research: {task_description}",
        agent=researcher,
        expected_output="Comprehensive research findings",
    )

    writing_task = Task(
        description="Write documentation from research",
        agent=writer,
        expected_output="Polished documentation",
    )

    crew = Crew(
        agents=[researcher, writer],
        tasks=[research_task, writing_task],
    )

    # CrewAI v0.80+ has built-in Langfuse callback
    result = crew.kickoff()

    get_client().update_current_observation(
        output=str(result),
        metadata={"agents": 2, "tasks": 2},
    )
    return result
```

### Setup

```python
# CrewAI Langfuse integration
import os
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-..."
os.environ["LANGFUSE_HOST"] = "https://cloud.langfuse.com"

# CrewAI auto-detects Langfuse env vars and sends traces
```

## LiveKit Agents

```python
# pip install livekit-agents langfuse
from langfuse import observe, get_client

@observe(type="agent", name="livekit_voice_agent")
async def run_voice_agent(session_id: str):
    """LiveKit voice agent with Langfuse tracing."""
    from livekit.agents import AutoSubscribe, JobContext, WorkerOptions
    from livekit.agents.voice_assistant import VoiceAssistant
    from livekit.plugins import openai, silero

    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=openai.LLM(model="gpt-5.2"),
        tts=openai.TTS(),
    )

    get_client().update_current_observation(
        metadata={
            "session_id": session_id,
            "pipeline": "vad→stt→llm→tts",
        },
    )
    return assistant


# LiveKit traces voice pipeline stages:
# VAD → STT → LLM → TTS (each as separate observation)
```

### Setup

```bash
# LiveKit exports OTEL traces to Langfuse
export OTEL_EXPORTER_OTLP_ENDPOINT="https://cloud.langfuse.com/api/public/otel"
export OTEL_EXPORTER_OTLP_HEADERS="x-langfuse-public-key=pk-...,x-langfuse-secret-key=sk-..."
```

## Amazon Bedrock AgentCore

```python
# pip install boto3 langfuse
from langfuse import observe, get_client

@observe(type="agent", name="bedrock_agent")
async def run_bedrock_agent(query: str):
    """Amazon Bedrock AgentCore with Langfuse tracing."""
    import boto3

    bedrock = boto3.client("bedrock-agent-runtime")

    response = bedrock.invoke_agent(
        agentId="AGENT_ID",
        agentAliasId="ALIAS_ID",
        sessionId="session-123",
        inputText=query,
    )

    output = ""
    for event in response["completion"]:
        if "chunk" in event:
            output += event["chunk"]["bytes"].decode()

    get_client().update_current_observation(
        input=query,
        output=output,
        metadata={"provider": "bedrock", "agent_id": "AGENT_ID"},
    )
    return output
```

### Setup

```python
# Bedrock traces via AWS X-Ray → OTEL → Langfuse
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from langfuse.opentelemetry import LangfuseSpanProcessor

processor = LangfuseSpanProcessor()
# Add to your OTEL tracer provider
```

## JavaScript/TypeScript Integration

All frameworks above also work in JS/TS using `@langfuse/otel`:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "@langfuse/otel";

const sdk = new NodeSDK({
  traceExporter: new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
  }),
});
sdk.start();

// All OTEL-compatible frameworks now trace to Langfuse
```

## Integration Matrix

| Framework | Python | JS/TS | Tracing Method | Auto-Instrument |
|-----------|--------|-------|----------------|-----------------|
| Claude Agent SDK | Yes | Yes | OTEL exporter | Manual `@observe` |
| OpenAI Agents | Yes | Yes | OTEL native | Auto via env vars |
| Pydantic AI | Yes | — | `.instrument()` | Auto |
| CrewAI | Yes | — | Callback | Auto via env vars |
| LiveKit Agents | Yes | Yes | OTEL exporter | Auto |
| Bedrock AgentCore | Yes | Yes | X-Ray → OTEL | Manual |
| LangChain | Yes | Yes | Callback | Auto |
| LangGraph | Yes | Yes | Callback | Auto |

## References

- [Langfuse Integrations](https://langfuse.com/docs/integrations)
- [OpenTelemetry Integration](https://langfuse.com/docs/integrations/opentelemetry)
- [Python SDK Integrations](https://langfuse.com/docs/integrations/python)
