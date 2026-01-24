# Verification Checklist

Pre-flight checklist for comprehensive feature verification with parallel agents.

## Pre-Verification Setup

### Context Gathering
- [ ] Run `git diff main --stat` to understand change scope
- [ ] Run `git log main..HEAD --oneline` to see commit history
- [ ] Identify affected domains (backend/frontend/both)
- [ ] Check for any existing failing tests

### Task Creation (CC 2.1.16)
- [ ] Create parent verification task
- [ ] Create subtasks for each agent domain
- [ ] Set proper dependencies if needed

## Agent Dispatch Checklist

### Required Agents (Full-Stack)
| Agent | Launched | Completed | Status |
|-------|----------|-----------|--------|
| code-quality-reviewer | [ ] | [ ] | Pending |
| security-auditor | [ ] | [ ] | Pending |
| test-generator | [ ] | [ ] | Pending |
| backend-system-architect | [ ] | [ ] | Pending |
| frontend-ui-developer | [ ] | [ ] | Pending |

### Optional Agents (Add as Needed)
| Condition | Agent | Launched |
|-----------|-------|----------|
| AI/ML features | llm-integrator | [ ] |
| Performance-critical | performance-engineer | [ ] |
| Database changes | database-engineer | [ ] |

## Quality Gate Checklist

### Mandatory Gates
| Gate | Threshold | Actual | Pass |
|------|-----------|--------|------|
| Test Coverage | >= 70% | ___% | [ ] |
| Security Critical | 0 | ___ | [ ] |
| Security High | <= 5 | ___ | [ ] |
| Type Errors | 0 | ___ | [ ] |
| Lint Errors | 0 | ___ | [ ] |

### Code Quality Gates
| Check | Status |
|-------|--------|
| No console.log in production | [ ] |
| No `any` types | [ ] |
| Exhaustive switches (assertNever) | [ ] |
| Proper error handling | [ ] |
| No hardcoded secrets | [ ] |

### Frontend-Specific Gates (if applicable)
| Check | Status |
|-------|--------|
| React 19 APIs used | [ ] |
| Zod validation on API responses | [ ] |
| Skeleton loading states | [ ] |
| Prefetching on links | [ ] |
| WCAG 2.1 AA compliance | [ ] |

### Backend-Specific Gates (if applicable)
| Check | Status |
|-------|--------|
| REST conventions followed | [ ] |
| Pydantic v2 validation | [ ] |
| RFC 9457 error handling | [ ] |
| Async timeout protection | [ ] |
| No N+1 queries | [ ] |

## Evidence Collection

### Required Evidence
- [ ] Test results with exit code
- [ ] Coverage report (JSON format)
- [ ] Linting results
- [ ] Type checking results
- [ ] Security scan results

### Optional Evidence
- [ ] E2E test screenshots
- [ ] Performance benchmarks
- [ ] Bundle size analysis
- [ ] Accessibility audit

## Report Generation

### Report Sections
- [ ] Summary (READY/NEEDS ATTENTION/BLOCKED)
- [ ] Agent Results (all 5 domains)
- [ ] Quality Gates table
- [ ] Blockers list (if any)
- [ ] Suggestions list
- [ ] Evidence links

### Final Steps
- [ ] Update all task statuses to completed
- [ ] Store verification evidence in context
- [ ] Generate final report markdown

## Quick Reference: Agent Prompts

### code-quality-reviewer
Focus: Lint, type check, anti-patterns, SOLID, complexity

### security-auditor
Focus: Dependency audit, secrets, OWASP Top 10, rate limiting

### test-generator
Focus: Coverage gaps, test quality, edge cases, flaky tests

### backend-system-architect
Focus: REST, Pydantic v2, RFC 9457, async safety, N+1

### frontend-ui-developer
Focus: React 19, Zod, exhaustive types, skeletons, prefetch, a11y

## Troubleshooting

### Agent Not Responding
1. Check if agent was launched with `run_in_background=True`
2. Verify agent name matches exactly
3. Check for context window limits

### Tests Failing
1. Run tests locally first
2. Check for missing dependencies
3. Verify test database state
4. Look for timing-dependent tests

### Coverage Below Threshold
1. Identify uncovered files
2. Check for excluded patterns
3. Focus on critical paths first
