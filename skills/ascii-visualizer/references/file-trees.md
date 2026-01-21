# File Tree Visualizations

Directory and file hierarchies.

## Basic Tree

```
project/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   └── services/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── pages/
│   └── public/
└── docs/
```

## With File Status

```
.claude/
├── skills/                    ✅ Token-optimized
│   ├── langfuse-observability/
│   │   ├── references/        ✅ 5 files
│   │   ├── scripts/         ✅ 2 files
│   │   └── SKILL.md           ✅ Linked
│   └── performance-optimization/
│       ├── references/        ✅ 5 files
│       └── scripts/         ✅ 5 files
└── agents/                    ✅ 10 agents
```

## Compact Format

```
src/
├─ components/    (12 files)
├─ hooks/         (8 files)
├─ utils/         (5 files)
└─ types/         (3 files)
```
