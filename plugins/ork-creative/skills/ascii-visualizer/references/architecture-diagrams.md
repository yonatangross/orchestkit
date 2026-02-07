# Architecture Diagrams

Box diagrams for system architecture.

**IMPORTANT:** All ASCII art requires a fixed-width (monospace) font for proper alignment. Recommended terminal width: 80-120 characters.

## Basic Pattern

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Component │────▶│  Component │────▶│  Component │
│      A     │     │      B     │     │      C     │
└────────────┘     └────────────┘     └────────────┘
```

## With Vertical Flow

```
        ┌────────────┐
        │   Client   │
        └──────┬─────┘
               │ HTTP
               ▼
        ┌────────────┐
        │ API Gateway│
        └──────┬─────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌────────────┐ ┌────────────┐
│  Service A │ │  Service B │
└────────────┘ └────────────┘
```

## Database Integration

```
┌──────────────┐
│  Application │
└───────┬──────┘
        │
        │ Read/Write
        ▼
┌──────────────┐      ┌──────────────┐
│   Primary    │─────▶│   Replica    │
│   Database   │      │   (Read Only)│
└──────────────┘      └──────────────┘
```
