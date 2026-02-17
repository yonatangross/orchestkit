---
title: "Performance: Locust"
category: perf
impact: MEDIUM
impactDescription: "Defines Python-based load testing patterns with task weighting and authentication flows using Locust"
tags: performance, locust, load-testing, python, task-weighting
---

# Locust Load Testing

```python
from locust import HttpUser, task, between

class APIUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def get_analyses(self):
        self.client.get("/api/analyses")

    @task(1)
    def create_analysis(self):
        self.client.post(
            "/api/analyses",
            json={"url": "https://example.com"}
        )

    def on_start(self):
        """Login before tasks."""
        self.client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password"
        })
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Tool | Locust for Python teams |
| Task weights | Higher weight = more frequent |
| Authentication | Use on_start for login |

**Incorrect — No authentication flow, requests fail:**
```python
class APIUser(HttpUser):
    @task
    def get_analyses(self):
        self.client.get("/api/analyses")  # 401 Unauthorized
```

**Correct — Login in on_start before tasks:**
```python
class APIUser(HttpUser):
    def on_start(self):
        self.client.post("/api/auth/login", json={
            "email": "test@example.com", "password": "password"
        })

    @task
    def get_analyses(self):
        self.client.get("/api/analyses")  # Authenticated
```
