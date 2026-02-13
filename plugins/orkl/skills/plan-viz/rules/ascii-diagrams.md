---
title: ASCII Diagram Fundamentals
impact: MEDIUM
impactDescription: "Consistent box-drawing characters and formatting ensure diagrams render correctly in all terminals"
tags: ascii, diagrams, box-drawing, visualization, monospace
---

## ASCII Diagram Fundamentals

**Incorrect — inconsistent characters and alignment:**
```
+-------+    +-------+
| Frontend | -> | Backend |
+-------+    +-------+
              |
          +--------+
          | Database |
          +--------+
```

**Correct — proper box-drawing characters with alignment:**
```
Box-Drawing Characters:
┌─┐│└─┘  Standard weight
┏━┓┃┗━┛  Heavy weight
├─┤┬┴    Connectors
╔═╗║╚═╝  Double lines
```

```
┌──────────────┐      ┌──────────────┐
│   Frontend   │─────>│   Backend    │
│   React 19   │      │   FastAPI    │
└──────────────┘      └───────┬──────┘
                              │
                              v
                      ┌──────────────┐
                      │  PostgreSQL  │
                      └──────────────┘
```

### Progress Tracking

```
[████████░░] 80% Complete
+ Design    (2 days)
+ Backend   (5 days)
~ Frontend  (3 days)
- Testing   (pending)
```

### File Trees

```
src/
├── api/
│   ├── routes.py          [M] +45 -12    !! high-traffic path
│   └── schemas.py         [M] +20 -5
├── services/
│   └── billing.py         [A] +180       ** new file
└── tests/
    └── test_billing.py    [A] +120       ** new file

Legend: [A]dd [M]odify [D]elete  !! Risk  ** New
```

### Workflow Diagrams

```
Backend  ===[Schema]======[API]===========================[Deploy]====>
                |            |                                ^
                |            +------blocks------+             |
                |                               |             |
Frontend ------[Wait]--------[Components]=======[Integration]=+

=== Active work   --- Blocked/waiting   | Dependency
```

### Key Rules

| Rule | Description |
|------|-------------|
| Font | Always monospace — box-drawing characters require fixed-width |
| Weight | Standard (─│) for normal, Heavy (━┃) for emphasis |
| Arrows | Use ─>, ──>, or │ with v/^ for direction |
| Alignment | Right-pad labels to match column widths |
| Annotations | Use !! for risk, ** for new, [A/M/D] for change type |
