---
title: "Performance: Test Types"
category: perf
impact: MEDIUM
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
