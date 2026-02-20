# Terminal Simulation Patterns

## Pinned Header + Scrolling Content

```typescript
const Terminal: React.FC<Props> = ({ frame, fps }) => {
  const LINE_HEIGHT = 22;
  const MAX_VISIBLE = 10;

  // Header stays pinned (command + task created message)
  const visibleHeader = HEADER_LINES.filter(line => frame >= line.frame);

  // Content scrolls to keep latest visible
  const visibleContent = CONTENT_LINES.filter(line => frame >= line.frame);
  const contentHeight = visibleContent.length * LINE_HEIGHT;
  const scrollOffset = Math.max(0, contentHeight - MAX_VISIBLE * LINE_HEIGHT);

  return (
    <div style={{ height: 420 }}>
      {/* Pinned header */}
      <div style={{ borderBottom: "1px solid #21262d" }}>
        {visibleHeader.map((line, i) => <TerminalLine key={i} {...line} />)}
      </div>

      {/* Scrolling content */}
      <div style={{ overflow: "hidden", height: 280 }}>
        <div style={{ transform: `translateY(-${scrollOffset}px)` }}>
          {visibleContent.map((line, i) => <TerminalLine key={i} {...line} />)}
        </div>
      </div>
    </div>
  );
};
```

## Agent Colors (Official Palette)

```typescript
const AGENT_COLORS = {
  workflow:     "#8b5cf6",  // Purple - workflow-architect
  backend:      "#06b6d4",  // Cyan - backend-system-architect
  security:     "#ef4444",  // Red - security-auditor
  performance:  "#22c55e",  // Green - frontend-performance-engineer
  frontend:     "#f59e0b",  // Amber - frontend-ui-developer
  data:         "#ec4899",  // Pink - data-pipeline-engineer
  llm:          "#6366f1",  // Indigo - llm-integrator
  docs:         "#14b8a6",  // Teal - documentation-specialist
};
```

## Task Spinner Animation

```typescript
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TaskSpinner: React.FC<{ frame: number; text: string; color: string }> = ({ frame, text, color }) => {
  const spinnerIdx = Math.floor(frame / 3) % SPINNER.length;
  return (
    <div style={{ color }}>
      <span style={{ marginRight: 8 }}>{SPINNER[spinnerIdx]}</span>
      {text}
    </div>
  );
};
```
