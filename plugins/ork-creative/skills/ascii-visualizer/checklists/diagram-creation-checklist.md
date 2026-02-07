# ASCII Diagram Creation Checklist

Comprehensive checklist for planning, creating, and maintaining ASCII diagrams in documentation and technical communication.

## Pre-Creation Planning

### Purpose & Audience
- [ ] Identify diagram purpose (architecture, flow, state, data model)
- [ ] Define target audience (developers, architects, stakeholders)
- [ ] Determine complexity level (overview vs. detailed)
- [ ] Choose appropriate diagram type for message
- [ ] Decide on level of detail to include
- [ ] Identify key concepts to highlight
- [ ] Plan for future updates/maintenance

### Diagram Type Selection
- [ ] **System Architecture**: Show components and relationships
- [ ] **Data Flow**: Illustrate request/response patterns
- [ ] **State Machine**: Display state transitions
- [ ] **Component Tree**: Hierarchical structure
- [ ] **Database Schema**: Entity relationships
- [ ] **Network Topology**: Infrastructure layout
- [ ] **Flow Chart**: Decision logic and branching
- [ ] **Sequence Diagram**: Time-ordered interactions
- [ ] **Timeline/Gantt**: Project scheduling
- [ ] **Table**: Structured comparison data

### Scope Definition
- [ ] Identify all components/entities to include
- [ ] Determine which details to omit (keep focused)
- [ ] Plan for multiple views if needed (split complex diagrams)
- [ ] Define diagram boundaries (what's in/out of scope)
- [ ] Identify critical paths or flows to emphasize
- [ ] List any assumptions or constraints
- [ ] Plan for progressive disclosure (overview → details)

## Box Drawing & Layout

### Character Selection
- [ ] Choose box style consistently (single/double/rounded)
  - `┌─┐ └─┘` Single line (general purpose)
  - `╔═╗ ╚═╝` Double line (emphasis/grouping)
  - `╭─╮ ╰─╯` Rounded (softer, UI elements)
- [ ] Select arrow types based on meaning
  - `→ ←` Single arrow (data flow)
  - `⇒ ⇐` Double arrow (strong/primary flow)
  - `➜` Heavy arrow (emphasis)
- [ ] Use consistent junction characters
  - `├ ┤ ┬ ┴ ┼` T-junctions and crosses
- [ ] Choose symbols for status/state
  - `✓ ✗` Success/failure
  - `● ○` Active/inactive
  - `[▶] [○] [✓]` Running/pending/complete

### Layout Planning
- [ ] Sketch rough layout on paper first
- [ ] Plan left-to-right or top-to-bottom flow
- [ ] Keep width under 80 characters (or 120 max)
- [ ] Use whitespace effectively (don't cram)
- [ ] Align related elements vertically/horizontally
- [ ] Group related components with visual proximity
- [ ] Plan for labels and annotations

### Box Sizing
- [ ] Size boxes proportionally to importance
- [ ] Ensure labels fit comfortably inside boxes
- [ ] Add padding (1-2 spaces) inside boxes
- [ ] Make all boxes in a group same size if logical
- [ ] Plan for multi-line content in boxes
- [ ] Consider box nesting for containment relationships

## Content & Labeling

### Labels & Text
- [ ] Use clear, concise labels (< 20 chars ideal)
- [ ] Avoid abbreviations unless well-known
- [ ] Add explanatory text where needed
- [ ] Use consistent terminology throughout
- [ ] Label all arrows and connections
- [ ] Number sequential steps (1. 2. 3.)
- [ ] Add units to measurements (ms, MB, etc.)

### Annotations
- [ ] Add title at top of diagram
- [ ] Include legend for symbols/colors
- [ ] Add notes for complex sections
- [ ] Document assumptions or constraints
- [ ] Include version/date (for living documents)
- [ ] Add author or maintainer info
- [ ] Link to related diagrams or docs

### Technical Details
- [ ] Include ports (e.g., "Port: 5173")
- [ ] Show protocols (HTTP, WSS, SQL)
- [ ] Add IP addresses or hostnames if relevant
- [ ] Show database table/column names
- [ ] Include API endpoints
- [ ] Show file paths or URLs
- [ ] Add configuration values (timeouts, limits)

## Relationships & Connections

### Arrows & Flow
- [ ] Use consistent arrow direction (left→right, top→down)
- [ ] Label all arrows with action/data type
- [ ] Show bidirectional flows clearly (↔)
- [ ] Use different arrow types for different meanings
- [ ] Avoid crossing lines where possible
- [ ] Use bridges (`─┬─`) when lines must cross
- [ ] Show parallel flows side-by-side

### Hierarchy & Containment
- [ ] Use indentation for child elements
- [ ] Use nested boxes for containment
- [ ] Show parent-child with tree structure (`└─`)
- [ ] Use consistent indentation (2-4 spaces)
- [ ] Group siblings visually
- [ ] Show 1:1, 1:N, N:M relationships clearly

### Dependencies
- [ ] Show required vs. optional dependencies
- [ ] Indicate dependency direction
- [ ] Show cyclic dependencies if present
- [ ] Mark external dependencies
- [ ] Show version requirements
- [ ] Indicate load order or execution sequence

## Specific Diagram Types

### System Architecture
- [ ] Show all major components/services
- [ ] Include infrastructure layer (DB, cache, queue)
- [ ] Show external dependencies (APIs, CDNs)
- [ ] Indicate network boundaries (DMZ, private subnets)
- [ ] Show load balancers, proxies, gateways
- [ ] Include monitoring/observability components
- [ ] Show data flow between components

### Data Flow Diagrams
- [ ] Use sequence/timeline format for clarity
- [ ] Number steps sequentially
- [ ] Show all actors (User, Frontend, Backend, DB)
- [ ] Indicate request and response
- [ ] Show async vs. sync operations
- [ ] Include error paths
- [ ] Show retry logic if relevant

### State Machines
- [ ] Show all states as boxes
- [ ] Use arrows for transitions
- [ ] Label transitions with triggers/actions
- [ ] Show initial state (often with bold/double box)
- [ ] Show final states clearly
- [ ] Include error/failure states
- [ ] Show transition conditions

### Component Trees
- [ ] Show root component at top
- [ ] Use tree branches (`└─ ├─`) consistently
- [ ] Indent children consistently
- [ ] Show multiplicity (×N for arrays)
- [ ] Group similar components
- [ ] Show props/data flow direction
- [ ] Include key/important child components

### Database Schemas
- [ ] Show all tables as boxes
- [ ] List columns with types
- [ ] Mark primary keys (PK)
- [ ] Mark foreign keys (FK)
- [ ] Show relationships with arrows
- [ ] Indicate cardinality (1:1, 1:N, N:M)
- [ ] Show indexes if relevant
- [ ] Include constraints (UNIQUE, NOT NULL)

### Network Diagrams
- [ ] Show all network segments/subnets
- [ ] Include IP ranges or addresses
- [ ] Show firewalls and security boundaries
- [ ] Indicate ports and protocols
- [ ] Show load balancers and gateways
- [ ] Include external connections (internet, VPN)
- [ ] Show redundancy/failover paths

## Clarity & Readability

### Visual Balance
- [ ] Distribute elements evenly across space
- [ ] Avoid clustering in one area
- [ ] Use consistent spacing between elements
- [ ] Align boxes and text where possible
- [ ] Create visual hierarchy (important → less important)
- [ ] Use whitespace to separate logical groups

### Simplification
- [ ] Remove unnecessary details
- [ ] Combine similar components
- [ ] Use grouping to reduce complexity
- [ ] Split overly complex diagrams into multiple views
- [ ] Use abstraction for repeated patterns
- [ ] Hide implementation details in overview diagrams
- [ ] Provide separate detailed diagrams if needed

### Consistency
- [ ] Use same box style throughout
- [ ] Use same arrow style for same relationship type
- [ ] Use consistent spacing/indentation
- [ ] Use consistent capitalization
- [ ] Use consistent abbreviations
- [ ] Maintain consistent alignment
- [ ] Use same legend symbols throughout

## Testing & Validation

### Rendering Check
- [ ] Test in target environment (GitHub, Markdown viewer)
- [ ] Check in monospace font (Courier, Monaco, Consolas)
- [ ] Verify on different screen sizes
- [ ] Test in dark mode and light mode
- [ ] Check line breaks don't break layout
- [ ] Verify Unicode characters render correctly
- [ ] Test in different editors (VS Code, vim, web)

### Accuracy Verification
- [ ] Verify all components are included
- [ ] Check all relationships are correct
- [ ] Validate technical details (ports, protocols)
- [ ] Confirm with subject matter experts
- [ ] Cross-reference with code/implementation
- [ ] Check against actual architecture
- [ ] Verify sequence of steps in flow diagrams

### Peer Review
- [ ] Have teammate review for clarity
- [ ] Ask non-expert to interpret diagram
- [ ] Gather feedback on missing details
- [ ] Check for ambiguities or confusion
- [ ] Validate legend is sufficient
- [ ] Confirm labels are clear
- [ ] Verify diagram answers intended questions

## Accessibility

### Screen Reader Compatibility
- [ ] Provide text description before diagram
- [ ] Summarize key relationships in prose
- [ ] Ensure labels are descriptive
- [ ] Avoid relying solely on visual position
- [ ] Use descriptive alt text if exporting to image
- [ ] Consider providing table format as alternative
- [ ] Test with screen reader if possible

### Alternative Formats
- [ ] Provide prose description alongside diagram
- [ ] Offer table format for comparisons
- [ ] Create simplified version for quick reference
- [ ] Export to image for presentations
- [ ] Generate interactive version if beneficial
- [ ] Link to source code/implementation
- [ ] Provide detailed specification document

## Maintenance

### Version Control
- [ ] Commit diagrams to version control
- [ ] Add diagram update to changelog
- [ ] Tag versions with dates
- [ ] Link to issues/PRs that prompted update
- [ ] Review and update during architecture changes
- [ ] Archive old versions for historical reference
- [ ] Document major diagram revisions

### Living Documentation
- [ ] Update diagrams when system changes
- [ ] Add TODO comments for planned changes
- [ ] Mark deprecated components
- [ ] Highlight areas under active development
- [ ] Link diagrams to code (bidirectional)
- [ ] Set reminders to review quarterly
- [ ] Assign ownership for each diagram

### Scalability
- [ ] Plan for future components
- [ ] Leave space for expansion
- [ ] Use modular design (can split later)
- [ ] Create overview + detail diagram pairs
- [ ] Document what's intentionally omitted
- [ ] Plan for additional views (security, data, etc.)

## OrchestKit-Specific Considerations

### Multi-Agent Architecture
- [ ] Show all 8 worker agents clearly
- [ ] Indicate supervisor-worker relationship
- [ ] Show parallel execution visually
- [ ] Include LangGraph orchestration layer
- [ ] Show agent communication patterns
- [ ] Indicate agent dependencies
- [ ] Show agent failure/retry logic

### Real-Time Features (SSE)
- [ ] Show SSE stream as ongoing connection
- [ ] Indicate event types and sequence
- [ ] Show buffering mechanism
- [ ] Illustrate reconnection handling
- [ ] Show multiple simultaneous streams
- [ ] Indicate event broadcasting pattern

### Data Flow
- [ ] Show URL → Analysis → Artifact flow
- [ ] Include all intermediate nodes
- [ ] Show quality gate checks
- [ ] Indicate async processing
- [ ] Show caching layers (L1, L2, L3)
- [ ] Include embedding generation
- [ ] Show search (semantic + keyword)

### Tech Stack
- [ ] Show React 19 + Vite frontend
- [ ] Show FastAPI + LangGraph backend
- [ ] Show PostgreSQL + PGVector
- [ ] Show Redis caching
- [ ] Show Langfuse observability
- [ ] Include port numbers (5173, 8500, 5437, 6379)
- [ ] Show Docker Compose containers

## Quality Gates

### Before Committing
- [ ] Diagram renders correctly in target environment
- [ ] All components/relationships are accurate
- [ ] Labels are clear and concise
- [ ] Legend explains all symbols
- [ ] Whitespace and alignment are clean
- [ ] Technical details are verified
- [ ] Peer reviewed for clarity

### Before Publishing
- [ ] Diagram serves its intended purpose
- [ ] Audience can understand without explanation
- [ ] No confidential information exposed
- [ ] Consistent with other project diagrams
- [ ] Linked from relevant documentation
- [ ] Alternative formats provided if needed
- [ ] Maintenance plan established

## Common Pitfalls to Avoid

- [ ] Avoid cramming too much in one diagram (split instead)
- [ ] Don't use inconsistent box styles (pick one)
- [ ] Don't omit legend for non-obvious symbols
- [ ] Avoid unlabeled arrows (always explain relationships)
- [ ] Don't use obscure Unicode characters (may not render)
- [ ] Avoid exceeding 120 character width (readability)
- [ ] Don't create diagrams that can't be updated easily
- [ ] Avoid mixing different levels of abstraction
- [ ] Don't use color as only differentiator (may not render)
- [ ] Avoid circular references without clear indication

## Best Practices Summary

1. **Plan before drawing** - Sketch rough layout first
2. **Stay focused** - One concept per diagram
3. **Be consistent** - Use same styles throughout
4. **Label everything** - No unlabeled arrows or boxes
5. **Use whitespace** - Don't cram elements together
6. **Test rendering** - Check in target environment
7. **Get feedback** - Have others review
8. **Keep it simple** - Complexity is the enemy
9. **Maintain regularly** - Update when system changes
10. **Provide context** - Add title, legend, description

## Tools & Resources

### Testing Rendering
- GitHub Markdown Preview
- VS Code Markdown Preview
- Monodraw (macOS diagram tool)
- ASCIIFlow (web-based diagram tool)
- Markdeep (enhanced Markdown renderer)

### Unicode References
- Unicode Box Drawing (U+2500–U+257F)
- Unicode Block Elements (U+2580–U+259F)
- Unicode Arrows (U+2190–U+21FF)
- Unicode Geometric Shapes (U+25A0–U+25FF)

### Export Options
- Take screenshot for presentations
- Export to SVG (some tools)
- Convert to Graphviz DOT for interactive versions
- Copy to Confluence/Notion with code blocks
- Export to PDF for distribution

---

**Remember:** The best diagram is the one that clearly communicates the intended message to the target audience. Clarity trumps complexity every time.

**OrchestKit Priority Diagrams:**
1. System overview (all layers)
2. LangGraph multi-agent workflow
3. SSE real-time update flow
4. Database schema with relationships
5. Hybrid search architecture (PGVector + BM25)
6. Deployment topology (Docker Compose)
