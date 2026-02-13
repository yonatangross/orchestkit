---
title: "Performance: Locust"
category: perf
impact: MEDIUM
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
