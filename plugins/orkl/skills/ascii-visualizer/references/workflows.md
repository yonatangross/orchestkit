# Workflow Visualizations

Step-by-step process flows.

## Linear Workflow

```
Start ──▶ Step 1 ──▶ Step 2 ──▶ Step 3 ──▶ End
```

## With Decision

```
        Start
          │
          ▼
    ┌─────────┐
    │ Validate│
    └────┬────┘
         │
    ┌────┴────┐
    │  Valid? │
    └────┬────┘
     Yes │ No
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│Process │ │ Reject │
└───┬────┘ └────────┘
    │
    ▼
  Success
```

## Pipeline Stages

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Fetch   │──▶│ Analyze  │──▶│  Score   │──▶│ Artifact │
│  (1.0s)  │   │ (12.5s)  │   │  (1.7s)  │   │  (0.5s)  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
```
