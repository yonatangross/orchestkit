# OpenAI Agents SDK

OpenAI Agents SDK patterns for handoffs, guardrails, agents-as-tools, and tracing.

## Basic Agent Definition

```python
from agents import Agent, Runner

agent = Agent(
    name="assistant",
    instructions="You are a helpful assistant that answers questions.",
    model="gpt-4o"
)

# Synchronous run
runner = Runner()
result = runner.run_sync(agent, "What is the capital of France?")
print(result.final_output)
```

## Handoffs Between Agents

```python
from agents import Agent, handoff
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

# Specialist agents
billing_agent = Agent(
    name="billing",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You handle billing inquiries. Check account status and payment issues.
Hand back to triage when billing issue is resolved.""",
    model="gpt-4o"
)

support_agent = Agent(
    name="support",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You handle technical support. Troubleshoot issues and provide solutions.
Hand back to triage when support issue is resolved.""",
    model="gpt-4o"
)

# Triage agent with handoffs
triage_agent = Agent(
    name="triage",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
You are the first point of contact. Determine the nature of inquiries.
- Billing questions: hand off to billing
- Technical issues: hand off to support
- General questions: answer directly""",
    model="gpt-4o",
    handoffs=[
        handoff(agent=billing_agent),
        handoff(agent=support_agent)
    ]
)
```

## Agents as Tools

```python
from agents import Agent, tool

# Define tool functions
@tool
def search_knowledge_base(query: str) -> str:
    """Search the knowledge base for relevant information."""
    # Implementation
    return search_results

@tool
def create_ticket(title: str, description: str, priority: str) -> str:
    """Create a support ticket in the system."""
    ticket_id = ticket_system.create(title, description, priority)
    return f"Created ticket {ticket_id}"

# Agent with tools
support_agent = Agent(
    name="support",
    instructions="Help users with technical issues. Search knowledge base first.",
    model="gpt-4o",
    tools=[search_knowledge_base, create_ticket]
)
```

## Guardrails

```python
from agents import Agent, InputGuardrail, OutputGuardrail
from agents.exceptions import InputGuardrailException

# Input guardrail
class ContentFilter(InputGuardrail):
    async def check(self, input_text: str) -> str:
        if contains_pii(input_text):
            raise InputGuardrailException("PII detected in input")
        return input_text

# Output guardrail
class ResponseValidator(OutputGuardrail):
    async def check(self, output_text: str) -> str:
        if contains_harmful_content(output_text):
            return "I cannot provide that information."
        return output_text

# Agent with guardrails
agent = Agent(
    name="safe_assistant",
    instructions="You are a helpful assistant.",
    model="gpt-4o",
    input_guardrails=[ContentFilter()],
    output_guardrails=[ResponseValidator()]
)
```

## Tracing and Observability

```python
from agents import Agent, Runner, trace

# Enable tracing
runner = Runner(trace=True)

# Custom trace spans
async def complex_workflow(task: str):
    with trace.span("research_phase"):
        research = await runner.run(researcher, task)

    with trace.span("writing_phase"):
        content = await runner.run(writer, research.final_output)

    return content

# Access trace data
result = await runner.run(agent, "Process this request")
print(result.trace_id)  # For debugging
```

## Streaming Responses

```python
from agents import Agent, Runner

agent = Agent(
    name="streamer",
    instructions="Provide detailed explanations.",
    model="gpt-4o"
)

runner = Runner()

# Stream response chunks
async for chunk in runner.stream(agent, "Explain quantum computing"):
    print(chunk.content, end="", flush=True)
```

## Multi-Agent Conversation

```python
from agents import Agent, Runner, Conversation

# Create conversation with multiple agents
conversation = Conversation()

# Add messages and run agents
conversation.add_user_message("I need help with my account")
result1 = await runner.run(triage_agent, conversation)

# Handoff handled automatically
conversation.add_agent_message(result1.final_output, agent=triage_agent)

# Continue conversation
conversation.add_user_message("Can you check my billing?")
result2 = await runner.run(result1.handoff_to or triage_agent, conversation)
```

## Configuration

- **Model**: Default is `gpt-4o`, supports all OpenAI models
- **Handoffs**: Use `RECOMMENDED_PROMPT_PREFIX` for reliable handoffs
- **Tools**: Use `@tool` decorator for type-safe tool definitions
- **Guardrails**: Chain multiple for defense-in-depth
- **Tracing**: Enable in production for debugging

## Best Practices

1. **Handoff clarity**: Use explicit handoff instructions in prompts
2. **Tool documentation**: Clear docstrings for tool selection
3. **Guardrail layers**: Input + output guardrails for safety
4. **Tracing**: Always enable in production
5. **Error handling**: Catch guardrail exceptions gracefully
