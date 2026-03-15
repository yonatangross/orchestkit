# PRD — Team Invitation System

**Status**: Draft v1.0
**Date**: 2026-03-14
**Author**: Yonatan Gross

---

## 1. Executive Summary

The Team Invitation System enables authenticated users to invite new members to their team via email. Invitees receive a time-limited magic link; clicking it creates or authenticates their account and joins them to the team. Admins can view pending invites and revoke any invite before it is accepted. Rate limiting prevents abuse.

**Problem in one sentence**: Teams cannot onboard new members without manual admin intervention or sharing credentials — there is no self-serve invite flow.

**Success metric**: ≥ 80% of sent invites are accepted within 48 hours (baseline: 0, manual onboarding).

---

## 2. Problem Statement

### Context

Teams currently onboard new members by having an admin manually create accounts or share login credentials — both are insecure and don't scale. There is no self-serve path for members to bring in collaborators.

### Pain Points

| Persona | Pain |
|---|---|
| **Team Member** | Can't invite a colleague without going through an admin |
| **Admin** | Manually creating accounts is slow; no audit trail for who invited whom |
| **Invitee** | Receives no guided onboarding; account creation is disconnected from joining the right team |
| **Security Team** | No revocation path; no visibility into outstanding access grants |

### Root Cause

No invitation entity exists in the data model. There is no flow that ties an email address to a team membership grant with an expiry and revocation mechanism.

---

## 3. Objectives & KPIs

### Objectives

1. **O1** — Enable any team member to invite others without admin intervention.
2. **O2** — Give admins full visibility and control over outstanding invites.
3. **O3** — Prevent invite abuse through rate limiting and expiry.

### KPIs

| KPI | Target | Measurement |
|---|---|---|
| Invite acceptance rate (within 48h) | ≥ 80% | `accepted_at - created_at` |
| Time-to-onboard new member | < 5 min (p90) | Invite sent → team joined |
| Invite abuse incidents | 0 | Security incident reports |
| Admin revocation success rate | 100% | Revoked invites that were not accepted after revocation |
| Rate-limit false positive rate | < 1% | Legit invites blocked per week |

---

## 4. User Stories (INVEST)

### Inviter Stories

**US-01** — Send invite by email
> As a **team member**, I want to **invite someone by email** so that **they can join my team without admin help**.

*Acceptance Criteria:*
- Given I am authenticated and on the team page, when I enter a valid email and submit, then an invite is created and an email is sent within 30 seconds.
- Given the email is already a team member, when I submit, then I see an error "This person is already on your team."
- Given the email has a pending invite, when I submit, then I see "An invite is already pending for this address."
- Given I have hit the rate limit (10 invites/hour), when I submit, then I receive a 429 error with a retry-after time.

---

**US-02** — View sent invites
> As a **team member**, I want to **see the status of invites I sent** so that **I know who has accepted and who hasn't**.

*Acceptance Criteria:*
- Given I navigate to the Invites tab, then I see a list of my sent invites with email, status (pending/accepted/expired/revoked), and sent-at time.
- Given an invite is older than 7 days and not accepted, its status shows "Expired".

---

### Invitee Stories

**US-03** — Accept invite via magic link
> As an **invitee**, I want to **click a link in my email and join the team** so that **I don't have to create an account manually**.

*Acceptance Criteria:*
- Given I click a valid invite link, when I am not yet registered, then I am shown an account creation form pre-filled with my email.
- Given I click a valid invite link, when I already have an account, then I am logged in (or prompted to log in) and immediately joined to the team.
- Given I click an expired link (> 7 days old), then I see "This invite has expired. Ask your teammate to send a new one."
- Given I click a revoked link, then I see "This invite is no longer valid."
- Given I click a link that has already been used, then I see "You've already joined this team."

---

### Admin Stories

**US-04** — View all pending invites
> As a **team admin**, I want to **see all outstanding invites for my team** so that **I have an audit trail of pending access grants**.

*Acceptance Criteria:*
- Given I am an admin on the Invites page, then I see all invites (pending, accepted, expired, revoked) with inviter name, invitee email, sent time, and status.
- Given I filter by "pending", then only unaccepted non-expired invites are shown.

---

**US-05** — Revoke an invite
> As a **team admin**, I want to **revoke a pending invite** so that **I can prevent unauthorized access if circumstances change**.

*Acceptance Criteria:*
- Given I click "Revoke" on a pending invite, when confirmed, then the invite status changes to "revoked" and the magic link becomes immediately invalid.
- Given I attempt to revoke an already-accepted invite, then I see "This invite has already been accepted — remove the member from the team instead."
- Given a revocation succeeds, then an audit log entry is written with admin ID, timestamp, and invite ID.

---

**US-06** — Re-send invite
> As a **team member**, I want to **re-send an expired invite** so that **the invitee gets a fresh link without me needing to fill in the form again**.

*Acceptance Criteria:*
- Given an invite is expired, when I click "Resend", then a new invite token is generated and a fresh email is sent; the old token is invalidated.
- Given I resend an invite, this counts against my hourly rate limit.

---

## 5. Functional Requirements

### 5.1 Invite Creation

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Accept a valid email address as invite target | P0 |
| FR-02 | Generate a cryptographically random token (≥ 32 bytes, URL-safe base64) | P0 |
| FR-03 | Store invite with: id, team_id, inviter_id, invitee_email, token_hash, status, created_at, expires_at, accepted_at, revoked_at, revoked_by | P0 |
| FR-04 | Set expiry to `created_at + 7 days` | P0 |
| FR-05 | Send invite email with magic link: `https://{host}/invite/{raw_token}` | P0 |
| FR-06 | Reject if invitee is already an active team member | P0 |
| FR-07 | Reject if a non-expired, non-revoked invite already exists for that email+team | P1 |

### 5.2 Invite Acceptance

| ID | Requirement | Priority |
|---|---|---|
| FR-08 | Look up invite by hashed token; reject if not found | P0 |
| FR-09 | Reject accepted, revoked, or expired invites with distinct error messages | P0 |
| FR-10 | If invitee has no account: show registration form pre-filled with email | P0 |
| FR-11 | If invitee has an account: authenticate (or prompt login) then proceed | P0 |
| FR-12 | On acceptance: create team membership, set invite status = accepted, set accepted_at | P0 |
| FR-13 | Invalidate token after single use | P0 |

### 5.3 Admin Controls

| ID | Requirement | Priority |
|---|---|---|
| FR-14 | Admin can view all invites for their team (filterable by status) | P0 |
| FR-15 | Admin can revoke any pending invite; sets status = revoked, revoked_at, revoked_by | P0 |
| FR-16 | Revoked token returns invalid on next use | P0 |
| FR-17 | Write audit log entry on revoke (admin_id, invite_id, timestamp, reason) | P1 |

### 5.4 Rate Limiting

| ID | Requirement | Priority |
|---|---|---|
| FR-18 | Limit: 10 invites per inviter per team per hour (sliding window) | P0 |
| FR-19 | Return HTTP 429 with `Retry-After` header when limit is exceeded | P0 |
| FR-20 | Admin bypass: team admins can send up to 50/hour | P1 |
| FR-21 | Global limit: 100 invite emails per team per day (spam prevention) | P1 |

### 5.5 Email

| ID | Requirement | Priority |
|---|---|---|
| FR-22 | Send transactional email: inviter name, team name, magic link, expiry date | P0 |
| FR-23 | Delivery within 30 seconds (p95) | P1 |
| FR-24 | Include plain-text fallback | P2 |
| FR-25 | Respect invitee's email unsubscribe preferences (transactional exemption applies) | P1 |

---

## 6. Non-Functional Requirements

### 6.1 Security

| ID | Requirement |
|---|---|
| NFR-01 | Tokens are never stored in plaintext; only SHA-256 hash stored in DB |
| NFR-02 | Magic link URL uses HTTPS only; HTTP redirects to HTTPS |
| NFR-03 | Token lookup is constant-time to prevent timing attacks |
| NFR-04 | Invite endpoints require authentication (invitees use the token as a credential for that endpoint only) |
| NFR-05 | Audit log is append-only; no update/delete on audit entries |
| NFR-06 | Rate limit state stored in Redis with TTL; no persistent state leakage |

### 6.2 Performance

| ID | Requirement |
|---|---|
| NFR-07 | Invite creation API: p99 < 300 ms |
| NFR-08 | Token validation (accept flow): p99 < 200 ms |
| NFR-09 | Admin invite list (up to 1000 invites): p99 < 500 ms |

### 6.3 Reliability

| ID | Requirement |
|---|---|
| NFR-10 | Email delivery failure must not fail the invite creation — use async queue with retry |
| NFR-11 | Invite records are durable; survive service restart |
| NFR-12 | Rate limit state loss (Redis restart) degrades gracefully — invites continue, limits reset |

### 6.4 Scalability

| ID | Requirement |
|---|---|
| NFR-13 | Support 10,000 pending invites per team |
| NFR-14 | Invite table indexed on: (token_hash), (team_id, status), (invitee_email, team_id) |

### 6.5 Compliance & Privacy

| ID | Requirement |
|---|---|
| NFR-15 | Invitee email addresses are PII — encrypted at rest |
| NFR-16 | Expired and revoked invite records purged after 90 days |
| NFR-17 | Audit logs retained for 1 year |

---

## 7. Release Plan

### Phase 1 — Core Invite Flow (MVP) · 2 weeks

**Scope:**
- FR-01 through FR-13 (create + accept)
- FR-18, FR-19 (rate limiting, 10/hour)
- FR-22 (invite email)
- NFR-01 through NFR-06 (security baseline)

**Exit criteria:**
- All P0 functional requirements pass acceptance tests
- Security tests pass (`npm run test:security`)
- Token hashing and constant-time comparison verified

---

### Phase 2 — Admin Controls · 1 week

**Scope:**
- FR-14 through FR-17 (admin view + revoke + audit log)
- FR-06 re-send flow (US-06)
- NFR-15 (PII encryption at rest)

**Exit criteria:**
- Admin can revoke in < 2 clicks
- Revoked token immediately rejected in integration test

---

### Phase 3 — Hardening & Compliance · 1 week

**Scope:**
- FR-20, FR-21 (admin bypass rate limit, daily team cap)
- FR-23–FR-25 (email delivery SLA, plain-text, unsubscribe)
- NFR-16, NFR-17 (data retention/purge jobs)
- Load test: 1,000 concurrent invites

**Exit criteria:**
- Load test meets NFR-07, NFR-08, NFR-09
- Purge job runs nightly in staging for 3 days without data loss

---

## 8. Appendices

### A. Data Model

```sql
-- invites table
CREATE TABLE invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES teams(id),
  inviter_id      UUID NOT NULL REFERENCES users(id),
  invitee_email   TEXT NOT NULL,          -- encrypted at rest
  token_hash      TEXT NOT NULL UNIQUE,   -- SHA-256 of raw token
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','expired','revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,   -- created_at + 7 days
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES users(id)
);

CREATE INDEX idx_invites_token_hash     ON invites (token_hash);
CREATE INDEX idx_invites_team_status    ON invites (team_id, status);
CREATE INDEX idx_invites_email_team     ON invites (invitee_email, team_id);

-- audit_log table
CREATE TABLE invite_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id   UUID NOT NULL REFERENCES invites(id),
  actor_id    UUID NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,  -- 'created' | 'accepted' | 'revoked' | 'resent' | 'expired'
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### B. API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/teams/:teamId/invites` | Member | Create invite |
| `GET` | `/api/teams/:teamId/invites` | Admin | List all invites |
| `DELETE` | `/api/teams/:teamId/invites/:inviteId` | Admin | Revoke invite |
| `POST` | `/api/teams/:teamId/invites/:inviteId/resend` | Inviter or Admin | Resend invite |
| `GET` | `/api/invite/:token` | None (token = credential) | Get invite info (for UI pre-fill) |
| `POST` | `/api/invite/:token/accept` | None (token = credential) | Accept invite |

### C. Rate Limit Algorithm

```
key   = "ratelimit:invite:{team_id}:{inviter_id}"
limit = 10 per hour (sliding window via Redis sorted set)
admin_limit = 50 per hour

ZADD key NOW score=NOW member=request_id
ZREMRANGEBYSCORE key -inf (NOW - 3600)
count = ZCARD key
if count > limit: return 429, Retry-After = oldest_entry + 3600 - NOW
EXPIRE key 3600
```

### D. Token Generation

```python
import secrets, hashlib, base64

def generate_invite_token() -> tuple[str, str]:
    raw = secrets.token_bytes(32)                          # 256 bits
    raw_url = base64.urlsafe_b64encode(raw).decode()       # URL-safe, 43 chars
    hashed = hashlib.sha256(raw).hexdigest()               # stored in DB
    return raw_url, hashed
```

### E. Open Questions

| # | Question | Owner | Due |
|---|---|---|---|
| OQ-1 | Should invitees be able to forward invite links? (token is single-use — forwarding = giving access) | Product | Phase 1 kickoff |
| OQ-2 | Should invite expiry be configurable per team (e.g., enterprise: 30 days)? | Product | Phase 2 |
| OQ-3 | Do we need SSO-linked invites (auto-provision via SAML)? | Engineering | Phase 3 |
| OQ-4 | Should rate limits be tenant-configurable (enterprise plans)? | Product | Phase 3 |

---

*Next step: `/ork:implement PRD-team-invitation-system.md`*
