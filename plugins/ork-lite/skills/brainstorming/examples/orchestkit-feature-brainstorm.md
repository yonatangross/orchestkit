# Example: OrchestKit Feature Brainstorming Session

## Feature Idea: Real-Time Collaborative Analysis Review

**Initial Request:**
"We should let multiple users review analysis results together, maybe like Google Docs but for technical content analysis."

---

## Phase 1: Clarifying Questions (Socratic Exploration)

**Agent:** Let's explore this idea through some foundational questions:

1. **Who is the primary user?**
   - Solo developers reviewing their own analyses?
   - Teams reviewing analyses before implementation?
   - Educational settings (instructor + students)?

2. **What problem does this solve?**
   - Is asynchronous commenting insufficient?
   - Do users need to see changes in real-time?
   - Is this about reducing review cycles or improving quality?

3. **When would users collaborate?**
   - During initial analysis (watching agents work)?
   - After completion (reviewing artifacts)?
   - During implementation (referencing analysis)?

4. **How does this fit OrchestKit's core value?**
   - OrchestKit generates implementation guides from technical content
   - Is collaboration about improving analysis inputs or outputs?
   - Does this enhance learning or just convenience?

---

## Phase 2: User Responses & Refinement

**User:** "Mainly teams reviewing analyses after completion. Current workflow has devs analyzing content separately, then discussing in Slack. We lose context switching between OrchestKit and Slack."

**Agent:** Excellent context! This narrows scope significantly. Let's refine:

**Refined Problem Statement:**
Teams using OrchestKit lose context when discussing analyses outside the platform, leading to fragmented feedback and slower implementation decisions.

**Next-Level Questions:**

1. **What specific actions do teams take during review?**
   - Highlighting relevant chunks?
   - Questioning agent findings?
   - Proposing implementation changes?
   - Voting on next steps?

2. **What information needs to be synchronized?**
   - Cursor positions? (high complexity)
   - Comments/annotations? (medium complexity)
   - Presence indicators (who's viewing)? (low complexity)

3. **What's the minimum viable collaboration?**
   - Asynchronous comments with @mentions?
   - Shared cursors and highlights?
   - Video chat integration?

---

## Phase 3: Constraint Analysis

**Agent:** Let's check this against OrchestKit's architecture:

**Technical Constraints:**
- ✅ Backend: FastAPI supports WebSockets (for real-time)
- ✅ Frontend: React 19 supports Suspense (for optimistic UI)
- ⚠️ Database: PostgreSQL needs LISTEN/NOTIFY for pub/sub
- ❌ No existing auth system for multi-user (planned but not built)

**Resource Constraints:**
- Current sprint: 2 weeks remaining
- Team: 2 developers (backend + frontend)
- Dependencies: Auth system (3-5 days), WebSocket infrastructure (2-3 days)

**User Experience Constraints:**
- Can't require all reviewers to be online simultaneously
- Must work for distributed teams (async-first)
- Mobile support not critical (desktop-focused workflow)

---

## Phase 4: Solution Variants

**Agent:** Based on constraints, here are 3 implementation levels:

### Option A: Async Comments (MVP - 3 days)
**What:**
- Thread-based comments on analysis sections
- @mentions for notifications
- Email digest of new comments

**Pros:**
- Builds on existing artifact display
- No WebSocket complexity
- Works async (global teams)

**Cons:**
- Not "real-time" (user's original ask)
- Still requires context switching to email

**Example User Flow:**
1. Alice completes analysis of "RAG Pipeline Best Practices"
2. Shares link with team in Slack
3. Bob adds comment: "Security analysis missing OWASP checks @alice"
4. Alice gets email notification with context snippet
5. Replies inline, updates analysis

---

### Option B: Presence + Live Comments (Standard - 7 days)
**What:**
- All of Option A, plus:
- Show who's viewing the analysis (presence indicators)
- Live comment updates via WebSockets
- Typing indicators

**Pros:**
- Feels collaborative (see teammates' activity)
- Reduces duplicate comments (see others typing)
- Better for synchronous review sessions

**Cons:**
- Requires WebSocket infrastructure
- More complex state management
- Needs connection health monitoring

**Example User Flow:**
1. Alice shares analysis link in Slack: "Reviewing RAG pipeline analysis now"
2. Bob clicks link, sees "Alice is viewing" badge
3. Bob starts typing comment on Security section
4. Alice sees "Bob is typing in Security Analysis..."
5. Alice waits for Bob's comment before adding her own

---

### Option C: Full Collaborative Editing (Advanced - 14 days)
**What:**
- All of Option B, plus:
- Collaborative editing of artifact summaries
- Shared cursors and highlights
- Conflict resolution (CRDT or OT)

**Pros:**
- True Google Docs experience
- Can refine analyses together
- Reduces "review → edit → re-review" cycles

**Cons:**
- High complexity (CRDT libraries)
- Requires authentication/authorization
- May confuse "agent-generated" vs "human-edited" content

**Example User Flow:**
1. Alice and Bob review analysis in real-time
2. Both see shared cursors as they scroll
3. Bob highlights "Missing: error handling patterns"
4. Alice immediately edits artifact to add error handling section
5. Both approve finalized artifact

---

## Phase 5: Decision Framework

**Agent:** Let's evaluate against OrchestKit's goals:

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| **Time to Value** | 3 days | 7 days | 14 days |
| **Solves Context Loss** | Partial (still async) | Yes (live updates) | Yes (fully integrated) |
| **Technical Risk** | Low | Medium | High |
| **Matches User Skill Level** | Familiar (like GitHub) | New but intuitive | Complex (edit conflicts) |
| **Scales to Team Size** | Excellent | Good | Requires moderation |
| **Enables Learning** | Yes (threaded discussion) | Yes (see peer insights) | Risk (edit wars) |

**Recommendation:** **Option B (Presence + Live Comments)**

**Rationale:**
1. **Addresses core problem:** Eliminates context switching while maintaining async-first design
2. **Balances complexity:** WebSockets are proven tech, no CRDT complexity
3. **Fits sprint:** 7 days leaves buffer for testing
4. **Enables future:** Presence infrastructure unlocks Option C later

---

## Phase 6: Implementation Plan

**Agent:** Here's the breakdown:

### Backend (3 days)
**Day 1: WebSocket Infrastructure**
- [ ] Add `fastapi-websockets` dependency
- [ ] Create `ConnectionManager` for presence tracking
- [ ] Add `/ws/analysis/{id}/presence` endpoint
- [ ] Redis pub/sub for multi-server scaling

**Day 2: Comment System**
- [ ] Database schema: `comments` table (analysis_id, user_id, section_id, content, created_at)
- [ ] REST endpoints: POST/GET/PATCH/DELETE `/api/v1/analyses/{id}/comments`
- [ ] WebSocket events: `comment.created`, `comment.updated`, `comment.deleted`

**Day 3: Presence Logic**
- [ ] Track active connections per analysis
- [ ] Broadcast join/leave events
- [ ] Typing indicators (debounced 1s)
- [ ] Heartbeat ping/pong for connection health

### Frontend (3 days)
**Day 1: WebSocket Client**
- [ ] Create `useAnalysisPresence` hook
- [ ] Handle reconnection logic (exponential backoff)
- [ ] Show connection status indicator

**Day 2: Comments UI**
- [ ] Comment thread component (nested replies)
- [ ] Markdown support for code snippets
- [ ] @mention autocomplete
- [ ] Optimistic updates (show immediately, sync later)

**Day 3: Presence UI**
- [ ] Avatar badges for active viewers
- [ ] Typing indicators in comment sections
- [ ] Toast notifications for new comments

### Testing (1 day)
- [ ] Unit tests: Comment CRUD operations
- [ ] Integration tests: WebSocket message flow
- [ ] E2E tests: Multi-user collaboration scenario
- [ ] Load test: 50 concurrent users on one analysis

---

## Phase 7: Success Metrics

**Agent:** How will we know this succeeded?

**Quantitative Metrics:**
- **Adoption:** 40%+ of team analyses have comments within 1 week
- **Engagement:** Average 3+ comments per analysis
- **Speed:** 30% reduction in time from analysis → implementation decision
- **Reliability:** 99.9% WebSocket uptime, <100ms message latency

**Qualitative Metrics:**
- **Survey:** "Collaboration features improved our review process" (4/5 rating)
- **Observation:** Teams stop using Slack for analysis discussions
- **Feedback:** "Presence indicators helped us avoid duplicate comments"

**Rollback Criteria:**
- WebSocket connection failures >5%
- User complaints about "too many notifications"
- Performance degradation (page load >2s with active presence)

---

## Key Takeaways

**Brainstorming Process Applied:**
1. ✅ **Socratic questioning** transformed vague idea into specific problem
2. ✅ **Constraint analysis** eliminated unrealistic options early
3. ✅ **Multiple variants** provided choice with clear tradeoffs
4. ✅ **Decision framework** aligned with project values
5. ✅ **Implementation plan** made idea actionable

**Outcome:**
Went from "Google Docs for technical analysis" → "Async-first collaborative comments with real-time presence" in ~20 minutes of structured exploration.

**Next Steps:**
- [ ] Share this RFC with team for feedback
- [ ] Create GitHub issue with Option B implementation plan
- [ ] Spike: Test Redis pub/sub with FastAPI WebSockets (2 hours)
