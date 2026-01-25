# NeMo Guardrails

## Overview

NeMo Guardrails is NVIDIA's framework for programmable LLM safety using Colang 2.0, a domain-specific language for defining conversational flows and guardrails.

## Installation

```bash
pip install nemoguardrails
```

## Directory Structure

```
config/
├── config.yml          # Main configuration
├── rails/
│   ├── input.co        # Input validation flows
│   ├── output.co       # Output validation flows
│   └── dialog.co       # Dialog management flows
├── prompts/
│   └── prompts.yml     # Custom prompts
└── actions/
    └── actions.py      # Custom Python actions
```

## Configuration (config.yml)

```yaml
# Model configuration
models:
  - type: main
    engine: openai
    model: gpt-4o
    parameters:
      temperature: 0.7
      max_tokens: 1024

  - type: embeddings
    engine: openai
    model: text-embedding-3-small

# Guardrails AI integration
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
            entities: ["phone_number", "email", "ssn", "credit_card"]
        - name: restricttotopic
          parameters:
            valid_topics: ["technology", "customer support"]
            invalid_topics: ["politics", "religion"]
        - name: valid_length
          parameters:
            min: 10
            max: 500

  # Input validation flows
  input:
    flows:
      - check jailbreak
      - guardrailsai check input $validator="guardrails_pii"
      - guardrailsai check input $validator="competitor_check"

  # Output validation flows
  output:
    flows:
      - check facts
      - guardrailsai check output $validator="toxic_language"
      - guardrailsai check output $validator="restricttotopic"
      - guardrailsai check output $validator="valid_length"

  # Dialog control
  dialog:
    single_call:
      enabled: true
      fallback_to_multiple: true

# Fact-checking configuration
fact_checking:
  enabled: true
  provider: alignscore  # or 'llm', 'nli'
  threshold: 0.7
  fallback: "I cannot verify this information."

# Knowledge base for RAG
knowledge_base:
  - type: kb
    source: docs/
    embeddings_model: text-embedding-3-small
```

## Colang 2.0 Syntax

### Basic Flows

```colang
# Define user intent patterns
define user ask about pricing
  "How much does it cost?"
  "What's the price?"
  "Pricing information"

# Define bot responses
define bot provide pricing info
  "Our plans start at $29/month. Would you like details?"

# Define conversation flow
define flow pricing inquiry
  user ask about pricing
  bot provide pricing info
```

### Input Rails

```colang
# Block jailbreak attempts
define flow check jailbreak
  """Detect and block jailbreak attempts."""
  user ...
  $is_jailbreak = execute check_jailbreak_attempt(user_message=$user_message)
  if $is_jailbreak
    bot "I cannot process that request."
    stop

# Sanitize input before processing
define flow sanitize input
  """Remove potentially harmful content from input."""
  user ...
  $sanitized = execute sanitize_user_input(text=$user_message)
  $user_message = $sanitized
```

### Output Rails

```colang
# Fact-checking for RAG responses
define flow check facts
  """Verify response is grounded in retrieved context."""
  bot ...
  $is_grounded = execute check_grounding(
    response=$bot_message,
    context=$retrieved_context
  )
  if not $is_grounded
    $bot_message = "I don't have verified information about that."

# Filter toxic content from responses
define flow filter toxic output
  """Remove toxic content from bot responses."""
  bot ...
  $toxicity_score = execute check_toxicity(text=$bot_message)
  if $toxicity_score > 0.5
    $bot_message = "I apologize, I cannot provide that response."
```

### Dialog Control

```colang
# Topic restriction
define flow restrict to allowed topics
  """Only respond to allowed topics."""
  user ask about $topic
  if $topic in ["technology", "support", "billing"]
    bot respond about $topic
  else
    bot "I can only help with technology, support, or billing questions."

# Human-in-the-loop for sensitive actions
define flow confirm sensitive action
  """Require confirmation for sensitive operations."""
  user request $action
  if $action in ["delete_account", "cancel_subscription", "export_data"]
    bot "This is a sensitive action. Please confirm by typing 'CONFIRM'."
    user confirm action
    if $user_message == "CONFIRM"
      execute perform_action(action=$action)
      bot "Action completed successfully."
    else
      bot "Action cancelled."
```

## Custom Actions (Python)

```python
# config/actions/actions.py
from nemoguardrails.actions import action
from nemoguardrails.actions.actions import ActionResult
import re

@action(name="check_jailbreak_attempt")
async def check_jailbreak_attempt(user_message: str) -> bool:
    """Detect potential jailbreak attempts."""
    jailbreak_patterns = [
        r"ignore.*previous.*instructions",
        r"pretend.*you.*are",
        r"act.*as.*if",
        r"disregard.*rules",
        r"bypass.*restrictions",
        r"DAN.*mode",
    ]

    for pattern in jailbreak_patterns:
        if re.search(pattern, user_message, re.IGNORECASE):
            return True
    return False

@action(name="sanitize_user_input")
async def sanitize_user_input(text: str) -> str:
    """Remove potentially harmful patterns from input."""
    # Remove potential injection patterns
    sanitized = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
    sanitized = re.sub(r'\{[^}]+\}', '', sanitized)  # Remove template literals
    return sanitized.strip()

@action(name="check_grounding")
async def check_grounding(response: str, context: list[str]) -> bool:
    """Verify response is grounded in context."""
    # Simple keyword overlap check
    response_words = set(response.lower().split())
    context_text = " ".join(context).lower()
    context_words = set(context_text.split())

    overlap = len(response_words & context_words)
    total = len(response_words)

    return (overlap / total) > 0.3 if total > 0 else False

@action(name="check_toxicity")
async def check_toxicity(text: str) -> float:
    """Check text for toxic content (stub - integrate with API)."""
    toxic_words = ["hate", "kill", "attack", "violence"]
    text_lower = text.lower()

    score = sum(1 for word in toxic_words if word in text_lower)
    return min(score / len(toxic_words), 1.0)
```

## Python Integration

```python
from nemoguardrails import RailsConfig, LLMRails

# Load configuration
config = RailsConfig.from_path("./config")

# Create rails instance
rails = LLMRails(config)

# Generate response with guardrails
async def generate_safe_response(user_message: str) -> str:
    """Generate LLM response with all guardrails applied."""
    response = await rails.generate_async(
        messages=[{
            "role": "user",
            "content": user_message
        }]
    )
    return response["content"]

# With streaming
async def stream_safe_response(user_message: str):
    """Stream LLM response with guardrails."""
    async for chunk in rails.stream_async(
        messages=[{"role": "user", "content": user_message}]
    ):
        yield chunk

# With conversation history
async def generate_with_history(
    messages: list[dict],
    context: dict = None
) -> str:
    """Generate with conversation context."""
    response = await rails.generate_async(
        messages=messages,
        options={
            "context": context or {},
        }
    )
    return response["content"]
```

## Hallucination Prevention

```colang
# Define fact-checking flow for RAG
define flow answer question with facts
  """Ensure RAG responses are factual."""
  user ask factual question
  $context = execute retrieve_context(query=$user_message)
  $answer = execute generate_answer(
    query=$user_message,
    context=$context
  )

  # Enable fact-checking
  $check_facts = True

  # Verify grounding
  $is_grounded = execute verify_grounding(
    answer=$answer,
    context=$context
  )

  if $is_grounded
    bot $answer
  else
    bot "I don't have enough verified information to answer that."

# Block hallucinations about specific entities
define flow check hallucination
  """Block responses about people without verification."""
  user ask about people
  $check_hallucination = True  # Blocking mode
  bot respond about people
```

## Best Practices

1. **Layer your rails**: Use input rails for validation, output rails for filtering
2. **Fail safely**: Always provide fallback responses when rails block content
3. **Log violations**: Track blocked requests for security monitoring
4. **Test extensively**: Use red-teaming to validate guardrails effectiveness
5. **Version your flows**: Track Colang file changes like code

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Rails not firing | Check flow definitions match user patterns |
| Slow response | Reduce number of chained validators |
| False positives | Adjust thresholds, add exceptions |
| Context not available | Verify context passed in options |
