# Complexity Scoring Reference

Detailed guide for assessing task complexity on a 1-5 scale.

---

## Level 1: Trivial

**Characteristics:**
- Single file change
- Simple variable rename
- Documentation update
- CSS styling tweak
- < 50 lines of code
- < 30 minutes estimated
- No dependencies
- No unknowns

**Examples:**
- Fix a typo in a string
- Update a constant value
- Add a comment to explain code
- Change button color in CSS

---

## Level 2: Simple

**Characteristics:**
- 1-3 file changes
- Basic function implementation
- Simple API endpoint (CRUD)
- Straightforward component
- 50-200 lines of code
- 30 minutes - 2 hours estimated
- 0-1 dependencies
- Minimal unknowns

**Examples:**
- Add a new utility function
- Create a simple React component
- Implement a basic GET endpoint
- Add form validation for one field

---

## Level 3: Moderate

**Characteristics:**
- 3-10 file changes
- Multiple component coordination
- API with validation and error handling
- State management integration
- Database schema changes
- 200-500 lines of code
- 2-8 hours estimated
- 2-3 dependencies
- Some unknowns that need research

**Examples:**
- Implement a feature with frontend and backend changes
- Add a new database table with API endpoints
- Create a form with multiple validation rules
- Integrate a simple third-party library

---

## Level 4: Complex

**Characteristics:**
- 10-25 file changes
- Cross-cutting concerns
- Authentication/authorization
- Real-time features (WebSockets)
- Payment integration
- Database migrations with data
- 500-1500 lines of code
- 8-24 hours (1-3 days) estimated
- 4-6 dependencies
- Significant unknowns
- Multiple decision points

**Examples:**
- Implement user authentication system
- Add WebSocket-based notifications
- Integrate payment gateway
- Create role-based access control

---

## Level 5: Very Complex

**Characteristics:**
- 25+ file changes
- Architectural changes
- New service/microservice
- Complete feature subsystem
- Third-party API integration
- Performance optimization
- 1500+ lines of code
- 24+ hours (3+ days) estimated
- 7+ dependencies
- Many unknowns
- Requires research and prototyping
- High risk of scope creep

**Examples:**
- Build a new microservice
- Implement a complete search system
- Major refactoring of core architecture
- Full AI/ML pipeline integration

---

## Quick Assessment Formula

```
Complexity = max(
  file_count_score,
  lines_of_code_score,
  dependency_score,
  unknowns_score
)
```

**File Count Score:**
- 1 file: Level 1
- 2-3 files: Level 2
- 4-10 files: Level 3
- 11-25 files: Level 4
- 25+ files: Level 5

**Lines of Code Score:**
- < 50: Level 1
- 50-200: Level 2
- 200-500: Level 3
- 500-1500: Level 4
- 1500+: Level 5

**Dependency Score:**
- 0 deps: Level 1
- 1 dep: Level 2
- 2-3 deps: Level 3
- 4-6 deps: Level 4
- 7+ deps: Level 5

**Unknowns Score:**
- No unknowns: Level 1-2
- Some unknowns: Level 3
- Significant unknowns: Level 4
- Many unknowns, needs research: Level 5

---

## Assessment Checklist

Before assigning a complexity score, answer:

1. [ ] How many files need to change?
2. [ ] Approximately how many lines of code?
3. [ ] What are the dependencies?
4. [ ] What unknowns exist?
5. [ ] How long would this take an experienced developer?
6. [ ] Are there cross-cutting concerns (auth, logging, etc.)?
7. [ ] Does this require database changes?
8. [ ] Does this integrate with external services?