# Rate Limiting Implementation Checklist

## Planning

- [ ] Define rate limits for each endpoint category
  - [ ] Read endpoints (GET) - higher limits
  - [ ] Write endpoints (POST/PUT/DELETE) - lower limits
  - [ ] Authentication endpoints - very strict limits
  - [ ] Expensive operations (LLM calls, file processing) - strictest limits

- [ ] Choose limiting algorithm
  - [ ] Token Bucket - for bursty traffic patterns
  - [ ] Sliding Window - for strict quotas
  - [ ] Fixed Window - for simple requirements

- [ ] Determine key strategy
  - [ ] By IP address (anonymous users)
  - [ ] By user ID (authenticated users)
  - [ ] By API key (service accounts)
  - [ ] By organization (enterprise customers)

## Implementation

### Backend Setup

- [ ] Install dependencies
  ```bash
  pip install slowapi redis
  ```

- [ ] Configure Redis connection
  ```python
  redis_client = Redis.from_url(settings.redis_url)
  ```

- [ ] Set up SlowAPI or custom limiter
  ```python
  limiter = Limiter(key_func=get_user_identifier)
  app.add_middleware(SlowAPIMiddleware)
  ```

### Route Protection

- [ ] Add `@limiter.limit()` to all public endpoints
- [ ] Set stricter limits for:
  - [ ] Login/register endpoints (prevent brute force)
  - [ ] Password reset (prevent enumeration)
  - [ ] File upload (prevent abuse)
  - [ ] LLM/AI operations (cost control)

### Response Headers

- [ ] Include rate limit headers in all responses:
  - [ ] `X-RateLimit-Limit` - max requests in window
  - [ ] `X-RateLimit-Remaining` - requests remaining
  - [ ] `X-RateLimit-Reset` - Unix timestamp when limit resets

- [ ] Include `Retry-After` header in 429 responses

### Error Handling

- [ ] Return proper 429 Too Many Requests status
- [ ] Include helpful error message
  ```json
  {
    "type": "https://api.example.com/problems/rate-limit-exceeded",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "You have exceeded 100 requests per minute. Please wait 45 seconds.",
    "retry_after": 45
  }
  ```

## Tiered Limits

- [ ] Define limits per user tier:
  | Tier | Requests/min | Burst |
  |------|-------------|-------|
  | Anonymous | 10 | 5 |
  | Free | 100 | 20 |
  | Pro | 1000 | 100 |
  | Enterprise | 10000 | 1000 |

- [ ] Implement dynamic limit function
  ```python
  def get_tier_limit(request: Request) -> str:
      user = request.state.user
      return TIER_LIMITS.get(user.tier, "10/minute")
  ```

## Distributed Systems

- [ ] Use Redis backend (not in-memory)
- [ ] Configure Redis connection pooling
- [ ] Set appropriate key TTLs
- [ ] Use Lua scripts for atomicity
- [ ] Handle Redis connection failures gracefully

## Monitoring

- [ ] Log rate limit hits
  ```python
  logger.warning("Rate limit exceeded", extra={
      "user_id": user.id,
      "endpoint": request.url.path,
      "limit": limit,
  })
  ```

- [ ] Track metrics:
  - [ ] Rate limit hits per endpoint
  - [ ] Rate limit hits per user
  - [ ] Average remaining quota

- [ ] Set up alerts for:
  - [ ] Unusual spike in 429 responses
  - [ ] Single user hitting limits repeatedly
  - [ ] Redis connection failures

## Security Considerations

- [ ] Rate limit login endpoints strictly (prevent brute force)
- [ ] Rate limit password reset (prevent enumeration)
- [ ] Consider IP reputation for anonymous limits
- [ ] Don't expose internal rate limit keys
- [ ] Use secure Redis connection (TLS)

## Documentation

- [ ] Document rate limits in OpenAPI/Swagger
- [ ] Add rate limit info to API documentation
- [ ] Include examples of handling 429 responses
- [ ] Explain tier limits for customers

## Testing

- [ ] Unit test rate limit logic
- [ ] Integration test with Redis
- [ ] Load test to verify limits work
- [ ] Test retry logic in clients
- [ ] Test header values are correct
- [ ] Test limit reset behavior

## Client SDK Recommendations

Document recommended client-side handling:

```python
# Python client example
import time
import httpx

def make_request_with_retry(url: str, max_retries: int = 3):
    for attempt in range(max_retries):
        response = httpx.get(url)

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            time.sleep(retry_after)
            continue

        return response

    raise Exception("Rate limit exceeded after retries")
```

## Rollout Checklist

- [ ] Deploy with monitoring enabled
- [ ] Start with permissive limits
- [ ] Monitor for false positives
- [ ] Gradually tighten limits
- [ ] Communicate changes to users
- [ ] Provide upgrade path for users hitting limits
