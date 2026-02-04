# Dependency Hotspot Diagram Templates

## Basic Dependency Graph

```
                    ┌──────────────┐
                    │   Target     │
                    │   Module     │
                    └──────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Dep A   │    │  Dep B   │    │  Dep C   │
    └──────────┘    └──────────┘    └──────────┘
```

## Fan-In / Fan-Out Chart

```
Fan-In (Dependents)        Fan-Out (Dependencies)
━━━━━━━━━━━━━━━━━━━        ━━━━━━━━━━━━━━━━━━━━━
module_a.py  ████████ 8    lib_x       ██████ 6
module_b.py  ██████ 6      lib_y       ████ 4
module_c.py  ████ 4        lib_z       ██ 2
module_d.py  ██ 2          internal    █ 1
```

## Coupling Matrix

```
             │ auth │ user │ api │ db │
─────────────┼──────┼──────┼─────┼────┤
auth         │  -   │  X   │  X  │  X │
user         │  X   │  -   │  X  │  X │
api          │      │      │  -  │    │
db           │      │      │     │  - │

X = bidirectional dependency (potential circular)
```

## Circular Dependency Visualization

```
    ┌─────────────────────────────┐
    │                             │
    ▼                             │
┌───────┐     ┌───────┐     ┌───────┐
│   A   │────▶│   B   │────▶│   C   │
└───────┘     └───────┘     └───────┘
    ▲                             │
    │                             │
    └─────────────────────────────┘
    CIRCULAR: A → B → C → A
```

## Change Impact Blast Radius

```
                    [CHANGED FILE]
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    [Direct: 3]     [Direct: 5]     [Direct: 2]
         │                │
    ┌────┴────┐      ┌────┴────┐
    │         │      │         │
[Trans: 2] [Trans: 4] [Trans: 1] [Trans: 3]

Total Impact: 3 + 5 + 2 = 10 direct
              2 + 4 + 1 + 3 = 10 transitive
```
