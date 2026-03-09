---
title: Define load, stress, spike, and soak testing patterns for comprehensive performance validation
category: perf
impact: MEDIUM
impactDescription: "Defines load, stress, spike, and soak testing patterns for comprehensive performance validation"
tags: performance, load-testing, stress-testing, spike-testing, soak-testing
---

# Performance Test Types

## Load Test (Normal expected load)

```javascript
export const options = {
  vus: 50,
  duration: '5m',
};
```

## Stress Test (Find breaking point)

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 300 },
    { duration: '2m', target: 400 },
  ],
};
```

## Spike Test (Sudden traffic surge)

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '1s', target: 1000 },  // Spike!
    { duration: '3m', target: 1000 },
    { duration: '10s', target: 10 },
  ],
};
```

## Soak Test (Sustained load for memory leaks)

```javascript
export const options = {
  vus: 50,
  duration: '4h',
};
```

## Common Mistakes

- Testing against production without protection
- No warmup period
- Unrealistic load profiles
- Missing error rate thresholds

**Incorrect — No warmup, sudden load spike:**
```javascript
export const options = {
  vus: 100,
  duration: '5m'
  // No ramp-up, cold start skews results
};
```

**Correct — Gradual ramp-up with warmup period:**
```javascript
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warmup
    { duration: '1m', target: 100 },   // Ramp up
    { duration: '3m', target: 100 },   // Steady load
    { duration: '30s', target: 0 }     // Ramp down
  ]
};
```
