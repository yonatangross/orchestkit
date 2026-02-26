# Brainstorming Session Checklist

Use this checklist to facilitate effective brainstorming sessions that transform rough ideas into actionable implementation plans.

---

## Pre-Session Preparation

### Context Gathering
- [ ] **Read the initial idea/request** - What is the user actually asking for?
- [ ] **Identify the problem domain** - Backend, frontend, infrastructure, process, UX?
- [ ] **Check existing system constraints** - Review architecture docs, tech stack, current capabilities
- [ ] **Review similar features** - Has this been attempted before? What can we learn?
- [ ] **Estimate time available** - Sprint timeline, team capacity, dependencies

### Stakeholder Identification
- [ ] **Primary user** - Who will use this feature?
- [ ] **Secondary users** - Who else is impacted?
- [ ] **Decision makers** - Who approves this?
- [ ] **Implementation team** - Who will build this?

---

## Phase 1: Exploration (Socratic Questioning)

### Foundational Questions
- [ ] **Who** is this for?
  - Primary user persona
  - User skill level (beginner, intermediate, expert)
  - Team size (solo, small team, enterprise)

- [ ] **What** problem does this solve?
  - Current pain point
  - Workarounds users are doing today
  - Impact if not solved (low, medium, high, critical)

- [ ] **When** does this problem occur?
  - User workflow stage
  - Frequency (daily, weekly, rare)
  - Time-sensitive vs. async

- [ ] **Where** in the system does this fit?
  - Existing feature enhancement vs. net-new
  - Integration points with other features
  - User journey touchpoints

- [ ] **Why** now?
  - Strategic priority
  - Market pressure
  - Technical debt reduction

- [ ] **How** is this currently done?
  - Manual workarounds
  - External tools
  - Cost of current solution

### Depth Questions (Ask 2-3 levels deep)
- [ ] "Can you give me an example of when this happened?"
- [ ] "What did you try that didn't work?"
- [ ] "What would success look like in 6 months?"
- [ ] "If we could only solve one part, which part matters most?"
- [ ] "What assumptions are we making?"

---

## Phase 2: Constraint Analysis

### Technical Constraints
- [ ] **Technology stack** - What tools/libraries are available?
- [ ] **Performance requirements** - Latency, throughput, scale
- [ ] **Data constraints** - Volume, retention, privacy/security
- [ ] **Integration points** - APIs, webhooks, third-party services
- [ ] **Browser/platform support** - Desktop, mobile, accessibility

### Resource Constraints
- [ ] **Time** - Sprint duration, deadline, phased rollout?
- [ ] **Team** - Available developers, skill levels, concurrent work
- [ ] **Budget** - Infrastructure costs, third-party services
- [ ] **Dependencies** - Blocked by other features? Auth, payments, etc.

### User Experience Constraints
- [ ] **Learning curve** - Matches user skill level?
- [ ] **Accessibility** - WCAG compliance, keyboard navigation
- [ ] **Mobile-first vs. desktop-first** - Primary usage context
- [ ] **Offline support** - Required or nice-to-have?
- [ ] **Internationalization** - Multiple languages needed?

---

## Phase 3: Solution Generation

### Create Multiple Variants (Aim for 3 options)

**For each option, document:**

#### Option Name (e.g., "MVP", "Standard", "Advanced")
- [ ] **What:** 2-3 sentence description of the solution
- [ ] **Scope:** List of included features (bullet points)
- [ ] **Excluded:** What's explicitly NOT included
- [ ] **Time estimate:** Days/weeks for implementation
- [ ] **Pros:** 3-5 advantages
- [ ] **Cons:** 3-5 disadvantages or risks
- [ ] **Example user flow:** Step-by-step scenario (5-7 steps)
- [ ] **Technical approach:** Key technologies/patterns

---

## Phase 4: Evaluation & Decision

### Create Decision Matrix

**Criteria to evaluate (customize per project):**
- [ ] **Time to value** - How quickly can users benefit?
- [ ] **Solves core problem** - Fully, partially, or tangentially?
- [ ] **Technical risk** - Low, medium, high complexity
- [ ] **User experience** - Intuitive, learnable, complex
- [ ] **Scalability** - Handles growth (users, data, features)
- [ ] **Maintainability** - Easy to debug, extend, document
- [ ] **Enables future work** - Unlocks other features vs. dead-end
- [ ] **Cost** - Infrastructure, development, ongoing maintenance

### Scoring
- [ ] Rate each option (1-5 scale or Low/Med/High)
- [ ] Identify deal-breakers (e.g., "Exceeds sprint timeline")
- [ ] Calculate weighted scores if needed

### Recommendation
- [ ] **Chosen option:** Which variant and why?
- [ ] **Rationale:** 2-3 sentences explaining decision
- [ ] **Tradeoffs acknowledged:** What are we giving up?
- [ ] **Risks to monitor:** What could go wrong?

---

## Phase 5: Implementation Planning

### Break Down Work

**For the chosen option:**

#### Backend Tasks
- [ ] List 5-10 concrete tasks
- [ ] Estimate effort (hours/days per task)
- [ ] Identify dependencies (what must happen first?)
- [ ] Tag technical risks

#### Frontend Tasks
- [ ] List 5-10 concrete tasks
- [ ] Estimate effort (hours/days per task)
- [ ] Identify shared components/utilities needed
- [ ] Tag UX decision points

#### Testing Tasks
- [ ] Unit tests for new logic
- [ ] Integration tests for API interactions
- [ ] E2E tests for critical user flows
- [ ] Performance/load testing if needed

#### Documentation Tasks
- [ ] API documentation
- [ ] User-facing docs
- [ ] Internal architecture notes
- [ ] Migration guides (if applicable)

### Create Timeline
- [ ] **Day 1-2:** [Tasks]
- [ ] **Day 3-4:** [Tasks]
- [ ] **Day 5+:** [Tasks]
- [ ] **Buffer:** Reserve 20-30% time for unknowns

---

## Phase 6: Success Metrics

### Define Success

#### Quantitative Metrics
- [ ] **Adoption:** What % of users will use this?
- [ ] **Engagement:** How often (daily, weekly)?
- [ ] **Performance:** Latency, uptime, error rate targets
- [ ] **Business impact:** Revenue, retention, cost savings

#### Qualitative Metrics
- [ ] **User satisfaction:** Survey ratings, NPS
- [ ] **User feedback:** Common praise/complaints
- [ ] **Observation:** Behavior changes noted

### Rollback Criteria
- [ ] **Performance degradation:** What's unacceptable?
- [ ] **Error rates:** Threshold for disabling feature
- [ ] **User complaints:** Volume/severity trigger
- [ ] **Business impact:** Negative outcomes to watch

---

## Post-Session Documentation

### Create RFC or Design Doc
- [ ] **Title:** Clear, descriptive name
- [ ] **Summary:** 2-3 sentences
- [ ] **Problem statement:** From exploration phase
- [ ] **Proposed solution:** Chosen option
- [ ] **Alternatives considered:** Other options + why rejected
- [ ] **Implementation plan:** Timeline and tasks
- [ ] **Success metrics:** How we'll measure
- [ ] **Risks:** What could go wrong
- [ ] **Open questions:** What's still TBD

### Share with Team
- [ ] Post RFC in team channel (Slack, Discord, etc.)
- [ ] Tag relevant stakeholders for review
- [ ] Set feedback deadline (24-48 hours)
- [ ] Schedule sync meeting if needed (complex changes)

### Create Actionable Issues
- [ ] Create GitHub/Jira issue with implementation plan
- [ ] Tag with appropriate labels (feature, backend, frontend, etc.)
- [ ] Assign to sprint/milestone
- [ ] Link to RFC/design doc

---

## Session Anti-Patterns to Avoid

### Common Pitfalls
- [ ] ❌ **Jumping to solutions** - Explore the problem first (5W1H)
- [ ] ❌ **Analysis paralysis** - Aim for 3 options, not 10
- [ ] ❌ **Ignoring constraints** - Be realistic about time/resources
- [ ] ❌ **Missing user voice** - Ground in real user needs
- [ ] ❌ **Vague estimates** - "A few days" → "3-5 days"
- [ ] ❌ **Skipping tradeoffs** - Every solution has pros AND cons
- [ ] ❌ **No decision** - End with clear recommendation
- [ ] ❌ **No next steps** - Create issues/tasks immediately

---

## Example Session Flow (30-45 minutes)

**Minute 0-10: Exploration**
- Ask 5W1H questions
- Dig 2-3 levels deep
- Document user context

**Minute 10-15: Constraints**
- List technical limitations
- Check time/resource budget
- Identify dependencies

**Minute 15-30: Solution Generation**
- Create 3 options (MVP, Standard, Advanced)
- Document pros/cons for each
- Write example user flows

**Minute 30-40: Evaluation**
- Score options against criteria
- Make recommendation
- Acknowledge tradeoffs

**Minute 40-45: Next Steps**
- Create implementation task list
- Define success metrics
- Assign follow-up actions

---

## Template Prompts

### Starting a Session
> "I have an idea: [rough idea]. Can you help me refine this into an actionable plan?"

### When Stuck
> "We've explored [option A] and [option B]. What other approaches should we consider?"

### When Overcomplicating
> "This feels complex. What's the simplest version that solves the core problem?"

### When Missing Context
> "What assumptions are we making? What don't we know yet?"

### Ending the Session
> "Based on our discussion, what should we build first?"

---

**Remember:** Great brainstorming is 70% asking questions, 20% generating options, 10% deciding. Resist the urge to code immediately—clarity saves days of rework.
