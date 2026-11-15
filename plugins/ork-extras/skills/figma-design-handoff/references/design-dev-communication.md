# Design-Dev Communication

Structured communication patterns for design handoff: PR templates, component status tracking, and annotation conventions.

## PR Template with Design Links

```markdown
## Design Reference

- **Figma file**: [Link to Figma file]
- **Figma frame**: [Link to specific frame/component]
- **Design status**: Ready for dev / In review / Needs design update

## Implementation Checklist

- [ ] All variants implemented (list variant names)
- [ ] Spacing matches Dev Mode measurements
- [ ] Colors reference design tokens (no hardcoded hex)
- [ ] Typography uses token scale
- [ ] Responsive behavior matches constraints
- [ ] Interactive states: hover, focus, active, disabled
- [ ] Accessibility: keyboard nav, screen reader, contrast
- [ ] Storybook story added for each variant
- [ ] Visual regression snapshot captured

## Screenshots

| Figma | Implementation |
|-------|---------------|
| [screenshot] | [screenshot] |
```

## Component Status Tracking

Track the handoff status of each component in a shared document or project board:

```markdown
| Component | Figma Status | Dev Status | Tokens | Visual QA |
|-----------|-------------|------------|--------|-----------|
| Button    | Ready       | Complete   | Synced | Approved  |
| Card      | Ready       | In PR      | Synced | Pending   |
| Modal     | In Review   | Not Started| —      | —         |
| Nav       | Ready       | Complete   | Synced | Failed    |
```

### Status Definitions

- **Figma Status**: Draft → In Review → Ready for Dev → Updated
- **Dev Status**: Not Started → In Progress → In PR → Complete
- **Tokens**: Not Defined → Exported → Synced → Verified
- **Visual QA**: Pending → Failed → Approved

## Figma Annotation Conventions

Designers should annotate Figma frames to communicate intent that is not captured by component properties:

### Annotation Types

1. **Interaction notes** — Describe hover effects, transitions, animations
   - Format: Yellow sticky with "Interaction:" prefix
   - Example: "Interaction: Card scales to 1.02 on hover with 200ms ease-out"

2. **Responsive notes** — Describe breakpoint behavior
   - Format: Blue sticky with "Responsive:" prefix
   - Example: "Responsive: Stack vertically below 768px, 2-col at 768px, 3-col at 1280px"

3. **Content rules** — Min/max content lengths, truncation behavior
   - Format: Green sticky with "Content:" prefix
   - Example: "Content: Title max 2 lines, truncate with ellipsis"

4. **Dev notes** — Technical implementation hints
   - Format: Purple sticky with "Dev:" prefix
   - Example: "Dev: Use Intersection Observer for lazy loading"

## Handoff Meeting Agenda

For complex features, run a 15-minute handoff sync:

1. **Walk through design** (5 min) — Designer shows the feature in Figma
2. **Token check** (3 min) — Verify all Variables are defined and exported
3. **Edge cases** (5 min) — Empty states, error states, loading states, overflow
4. **Questions** (2 min) — Developer clarifies ambiguities

## Feedback Loop

When developers find issues during implementation:

1. Comment directly on the Figma frame (not Slack/email)
2. Tag the designer with `@mention`
3. Include: what is unclear, what the proposed implementation is, screenshot if applicable
4. Designer resolves or updates the design
5. Token re-sync if design changes affect variables
