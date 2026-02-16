---
title: Python Backend Profiling
impact: MEDIUM
impactDescription: "Production profiling with py-spy identifies CPU hotspots and memory leaks without modifying code or restarting services"
tags: py-spy, cprofile, memory-profiler, python, sampling, profiling, flamegraph
---

# Python Backend Profiling

Profile Python services to find CPU bottlenecks and memory leaks.

## py-spy for Production Sampling

```bash
# Attach to running process (no restart needed)
py-spy top --pid 12345

# Generate flamegraph SVG
py-spy record -o profile.svg --pid 12345 --duration 30

# Profile a script directly
py-spy record -o profile.svg -- python manage.py runserver

# Sample at higher rate for short-lived operations
py-spy record --rate 250 -o profile.svg -- python batch_job.py
```

## cProfile for Development

```python
import cProfile
import pstats

# Profile a function
with cProfile.Profile() as pr:
    result = expensive_function()

stats = pstats.Stats(pr)
stats.sort_stats('cumulative')
stats.print_stats(20)  # Top 20 functions

# One-liner from command line
# python -m cProfile -s cumulative app.py
```

## memory_profiler for Memory Leaks

```python
from memory_profiler import profile

@profile
def process_data():
    data = load_large_dataset()     # +500 MiB
    filtered = filter_items(data)   # +200 MiB
    del data                        # -500 MiB
    return summarize(filtered)

# Command line: python -m memory_profiler script.py
```

## FastAPI Middleware Profiling

```python
import time
from fastapi import Request

@app.middleware("http")
async def profile_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    if duration > 0.5:  # Log slow requests
        print(f"SLOW: {request.method} {request.url.path} took {duration:.2f}s")
    response.headers["X-Response-Time"] = f"{duration:.3f}"
    return response
```

**Incorrect — cProfile in production requires code changes:**
```python
# Must instrument code manually
with cProfile.Profile() as pr:
    result = expensive_function()
```

**Correct — py-spy attaches to running process with zero overhead:**
```bash
# No code changes, no restart needed
py-spy record -o profile.svg --pid 12345 --duration 30
```

**Key rules:**
- **Use** py-spy in production (zero overhead when not profiling, no code changes)
- **Use** cProfile in development for detailed call graphs
- **Use** memory_profiler to track per-line memory allocation
- **Profile** under realistic load, not just unit test conditions
- **Focus** on the top 3-5 hotspots by cumulative time
