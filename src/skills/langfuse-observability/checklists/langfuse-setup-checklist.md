# Langfuse Setup Checklist

Complete guide for setting up Langfuse observability in your application, based on OrchestKit's production implementation.

## Prerequisites

- [ ] Python 3.10+ or Node.js 18+ application
- [ ] LLM integration (OpenAI, Anthropic, Google, etc.)
- [ ] PostgreSQL database (for self-hosted Langfuse)
- [ ] Docker and docker-compose (recommended for self-hosting)

## Phase 1: Langfuse Server Setup

### Option A: Langfuse Cloud (Fastest)

- [ ] Sign up at [cloud.langfuse.com](https://cloud.langfuse.com)
- [ ] Create new project
- [ ] Copy `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY`
- [ ] Copy `LANGFUSE_HOST` (usually `https://cloud.langfuse.com`)

### Option B: Self-Hosted (Recommended for Production)

- [ ] Create `docker-compose.yml` for Langfuse:
  ```yaml
  services:
    langfuse-server:
      image: langfuse/langfuse:latest
      ports:
        - "3000:3000"
      environment:
        DATABASE_URL: postgresql://langfuse:password@postgres:5432/langfuse
        NEXTAUTH_SECRET: your-secret-key-here  # Generate: openssl rand -base64 32
        NEXTAUTH_URL: http://localhost:3000
        SALT: your-salt-here  # Generate: openssl rand -base64 32
      depends_on:
        - postgres

    postgres:
      image: postgres:15
      environment:
        POSTGRES_USER: langfuse
        POSTGRES_PASSWORD: password
        POSTGRES_DB: langfuse
      volumes:
        - langfuse-postgres:/var/lib/postgresql/data

  volumes:
    langfuse-postgres:
  ```

- [ ] Start Langfuse: `docker-compose up -d`
- [ ] Visit `http://localhost:3000` and create admin account
- [ ] Create project in UI
- [ ] Copy API keys from Settings → API Keys

## Phase 2: SDK Installation

### Python (FastAPI/Flask/Django)

- [ ] Install SDK: `pip install langfuse`
- [ ] Add to requirements.txt: `langfuse>=2.0.0`

### Node.js (Express/Next.js)

- [ ] Install SDK: `npm install langfuse`
- [ ] Add to package.json: `"langfuse": "^3.0.0"`

## Phase 3: Configuration

### Environment Variables

- [ ] Add to `.env`:
  ```bash
  LANGFUSE_PUBLIC_KEY=pk-lf-...
  LANGFUSE_SECRET_KEY=sk-lf-...
  LANGFUSE_HOST=http://localhost:3000  # or https://cloud.langfuse.com
  ```

- [ ] Add to `.env.example` (without values):
  ```bash
  LANGFUSE_PUBLIC_KEY=
  LANGFUSE_SECRET_KEY=
  LANGFUSE_HOST=
  ```

- [ ] Add to `.gitignore`: `.env`

### Application Config

**Python (backend/app/core/config.py):**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    LANGFUSE_PUBLIC_KEY: str
    LANGFUSE_SECRET_KEY: str
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] Create settings class with Langfuse fields
- [ ] Validate environment variables on startup
- [ ] Add type hints for all config fields

## Phase 4: Client Initialization

### Python Client

**File:** `backend/app/shared/services/langfuse/client.py`

```python
from langfuse import Langfuse
from app.core.config import settings

langfuse_client = Langfuse(
    public_key=settings.LANGFUSE_PUBLIC_KEY,
    secret_key=settings.LANGFUSE_SECRET_KEY,
    host=settings.LANGFUSE_HOST,
    debug=False,  # Set to True in development
    enabled=True  # Set to False to disable tracing
)
```

- [ ] Create dedicated client module
- [ ] Use singleton pattern for client instance
- [ ] Add debug mode for development
- [ ] Add enabled flag for testing/CI

### Node.js Client

**File:** `src/lib/langfuse.ts`

```typescript
import { Langfuse } from 'langfuse';

export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  debug: process.env.NODE_ENV === 'development',
  enabled: process.env.NODE_ENV !== 'test'
});
```

- [ ] Create dedicated client module
- [ ] Add TypeScript types
- [ ] Disable in test environment
- [ ] Enable debug mode in development

## Phase 5: Decorator-Based Tracing

### Python @observe Decorator

**Example:** `backend/app/services/analysis.py`

```python
from langfuse.decorators import observe, langfuse_context

@observe(name="analyze_content")
async def analyze_content(url: str, content: str) -> AnalysisResult:
    """Analyze content with automatic Langfuse tracing."""

    # Set trace-level metadata
    langfuse_context.update_current_trace(
        name="content_analysis",
        session_id=f"analysis_{analysis_id}",
        user_id="system",
        metadata={
            "url": url,
            "content_length": len(content)
        },
        tags=["production", "v1"]
    )

    # Nested function - creates child span automatically
    @observe(name="fetch_metadata")
    async def fetch_metadata():
        # ... work ...
        pass

    # All nested calls create child spans
    metadata = await fetch_metadata()
    embedding = await generate_embedding(content)  # Also @observe decorated

    return AnalysisResult(metadata=metadata)
```

- [ ] Add @observe to all async functions that call LLMs
- [ ] Set meaningful span names
- [ ] Add session_id for multi-step workflows
- [ ] Add user_id for user-facing features
- [ ] Tag traces by environment (production/staging)

## Phase 6: LLM Call Instrumentation

### Anthropic Claude

```python
from langfuse.decorators import observe, langfuse_context
from anthropic import AsyncAnthropic

anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

@observe(name="llm_call")
async def call_claude(prompt: str, model: str = "claude-sonnet-4-20250514") -> str:
    """Call Claude with cost tracking."""

    # Log input
    langfuse_context.update_current_observation(
        input=prompt[:2000],  # Truncate large prompts
        model=model
    )

    # Call LLM
    response = await anthropic_client.messages.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096
    )

    # Extract tokens
    input_tokens = response.usage.input_tokens
    output_tokens = response.usage.output_tokens

    # Calculate cost (Claude Sonnet 4.5: $3/MTok input, $15/MTok output)
    cost_usd = (input_tokens / 1_000_000) * 3.00 + (output_tokens / 1_000_000) * 15.00

    # Log output and usage
    langfuse_context.update_current_observation(
        output=response.content[0].text[:2000],
        usage={
            "input": input_tokens,
            "output": output_tokens,
            "unit": "TOKENS"
        },
        metadata={"cost_usd": cost_usd}
    )

    return response.content[0].text
```

- [ ] Wrap all LLM calls with @observe
- [ ] Log input/output (truncated)
- [ ] Track token usage
- [ ] Calculate and log costs
- [ ] Add model name to metadata

### OpenAI

```python
@observe(name="llm_call")
async def call_openai(prompt: str, model: str = "gpt-4o") -> str:
    """Call OpenAI with cost tracking."""

    langfuse_context.update_current_observation(
        input=prompt[:2000],
        model=model
    )

    response = await openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )

    # OpenAI pricing (gpt-4o: $2.50/MTok input, $10/MTok output)
    input_tokens = response.usage.prompt_tokens
    output_tokens = response.usage.completion_tokens
    cost_usd = (input_tokens / 1_000_000) * 2.50 + (output_tokens / 1_000_000) * 10.00

    langfuse_context.update_current_observation(
        output=response.choices[0].message.content[:2000],
        usage={
            "input": input_tokens,
            "output": output_tokens,
            "unit": "TOKENS"
        },
        metadata={"cost_usd": cost_usd}
    )

    return response.choices[0].message.content
```

- [ ] Add pricing for your models
- [ ] Update pricing when model costs change
- [ ] Log model name for each call

## Phase 7: Quality Scoring

### Add Evaluation Scores

```python
from langfuse.decorators import langfuse_context

@observe(name="evaluate_quality")
async def evaluate_response(query: str, response: str) -> dict:
    """Evaluate LLM response quality."""

    # Run evaluation (your logic here)
    scores = {
        "relevance": 0.85,
        "coherence": 0.92,
        "depth": 0.78
    }

    # Add scores to current trace
    for criterion, score in scores.items():
        langfuse_context.score(
            name=criterion,
            value=score,
            comment=f"Evaluated {criterion} of response"
        )

    # Add overall score
    overall = sum(scores.values()) / len(scores)
    langfuse_context.score(
        name="overall_quality",
        value=overall,
        comment="Average of all criteria"
    )

    return scores
```

- [ ] Add quality scoring for all LLM outputs
- [ ] Use consistent criterion names
- [ ] Track scores over time
- [ ] Add comments explaining scores

## Phase 8: Testing & Validation

### Test Trace Creation

```python
import pytest
from app.shared.services.langfuse.client import langfuse_client

@pytest.mark.asyncio
async def test_langfuse_trace_creation():
    """Verify Langfuse traces are created."""

    trace = langfuse_client.trace(
        name="test_trace",
        metadata={"test": True}
    )

    generation = trace.generation(
        name="test_generation",
        model="claude-sonnet-4-20250514",
        input="Test prompt",
        output="Test response",
        usage={"input": 10, "output": 5, "unit": "TOKENS"}
    )

    # Flush to ensure data is sent
    langfuse_client.flush()

    assert trace.id is not None
    assert generation.id is not None
```

- [ ] Add integration tests for tracing
- [ ] Test trace creation
- [ ] Test score logging
- [ ] Verify data appears in UI

### Verify in Langfuse UI

- [ ] Visit Langfuse UI
- [ ] Check Traces tab for test traces
- [ ] Verify metadata appears correctly
- [ ] Check Scores tab for quality metrics
- [ ] Verify cost calculations are accurate

## Phase 9: Production Monitoring

### Create Dashboards

- [ ] **Cost Dashboard** - Track spending by model, user, time
- [ ] **Quality Dashboard** - Monitor quality scores over time
- [ ] **Performance Dashboard** - Track latency by operation
- [ ] **Error Dashboard** - Failed traces, error rates

### Set Up Alerts (via Langfuse UI or SQL)

```sql
-- Alert: Daily cost exceeds $100
SELECT
    DATE(timestamp) as date,
    SUM(calculated_total_cost) as daily_cost
FROM traces
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY DATE(timestamp)
HAVING SUM(calculated_total_cost) > 100;
```

- [ ] Daily cost threshold alerts
- [ ] Quality score degradation alerts
- [ ] High latency alerts
- [ ] Error rate alerts

### Weekly Review Process

- [ ] Review top 10 most expensive traces
- [ ] Analyze quality score trends
- [ ] Identify optimization opportunities
- [ ] Update prompt versions based on scores

## Phase 10: Advanced Features

### Prompt Management

- [ ] Create prompts in Langfuse UI
- [ ] Version prompts (v1, v2, etc.)
- [ ] Use `langfuse.get_prompt()` in code
- [ ] A/B test prompt versions
- [ ] Promote winning prompts to production

### Dataset Evaluation

- [ ] Create evaluation datasets in UI
- [ ] Run automated evaluations
- [ ] Track accuracy over time
- [ ] Compare model versions

## Troubleshooting

### Traces Not Appearing

- [ ] Check API keys are correct
- [ ] Verify `LANGFUSE_HOST` matches server
- [ ] Check `enabled=True` in client
- [ ] Call `langfuse_client.flush()` in tests
- [ ] Check network connectivity to Langfuse server

### High Latency

- [ ] Enable async mode: `flush_at=20` (batch sends)
- [ ] Reduce metadata size (truncate large strings)
- [ ] Use background thread for flushing

### Missing Costs

- [ ] Verify usage data is logged: `{"input": X, "output": Y, "unit": "TOKENS"}`
- [ ] Check model pricing in Langfuse UI (Settings → Models)
- [ ] Add custom pricing if model not in database

## References

- [Langfuse Documentation](https://langfuse.com/docs)
- [Python SDK Guide](https://langfuse.com/docs/sdk/python)
- [Self-Hosting Guide](https://langfuse.com/docs/deployment/self-host)
- [Cost Tracking](https://langfuse.com/docs/model-usage-and-cost)
- Template: `../scripts/langfuse-decorator-pattern.py`
