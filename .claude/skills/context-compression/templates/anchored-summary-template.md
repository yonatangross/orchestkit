# Anchored Summary Template

Use this template when compressing conversation history. All sections are **REQUIRED**.

---

## Template

```markdown
# Session Summary
**Compression #:** [number]
**Timestamp:** [ISO timestamp]
**Messages Compressed:** [range, e.g., 1-25]

---

## Session Intent
[REQUIRED: What is the user trying to accomplish? Be specific.]

Example:
- "Implement OAuth 2.0 authentication with Google provider for React web app"
- "Debug intermittent 500 errors in payment processing endpoint"
- "Refactor user service to support multi-tenancy"

---

## Files Modified
[REQUIRED: List each file with specific changes made]

Format:
- `path/to/file.ext`: [Change 1], [Change 2]

Example:
- `src/auth/oauth.ts`: Added Google OAuth flow, implemented token refresh
- `src/api/users.ts`: Added getCurrentUser endpoint, fixed validation bug
- `prisma/schema.prisma`: Added RefreshToken model, updated User relations

---

## Decisions Made
[REQUIRED: Key decisions with rationale]

Format:
- **[Decision]**: [Rationale]

Example:
- **JWT over sessions**: Chose JWT for stateless architecture, better horizontal scaling
- **Refresh token rotation**: Implementing rotation for security, 7-day expiry
- **Deferred MFA**: Postponed to next sprint, not blocking for MVP

---

## Technical Context
[REQUIRED: Important technical details for continuity]

Example:
- Using `@auth/core` v5.0 for OAuth implementation
- Database is PostgreSQL 16 with Prisma ORM
- Frontend is React 19 with TanStack Query for data fetching
- Token storage: httpOnly cookies (decided against localStorage)

---

## Current State
[REQUIRED: Where are we in the task? What's working/not working?]

Example:
- OAuth flow: ✅ Complete and tested
- Token refresh: 🔄 In progress, endpoint created but untested
- Frontend integration: ⏳ Not started
- Tests: ❌ Need to add before PR

---

## Blockers / Open Questions
[REQUIRED: List any blockers or questions awaiting answers. Empty if none.]

Example:
- Awaiting decision on token expiry duration from security team
- Need clarification: Should refresh tokens survive password change?
- Blocked: CI pipeline failing on unrelated test, need DevOps help

If none: "No current blockers."

---

## Errors Encountered
[REQUIRED: Notable errors and their resolution status]

Format:
- **[Error]**: [Status] - [Resolution/Notes]

Example:
- **CORS on /oauth/callback**: ✅ Resolved - Added origin to allowlist
- **Prisma migration conflict**: ✅ Resolved - Rebased on main
- **Token validation 401**: 🔄 Investigating - Suspect clock skew

If none: "No significant errors encountered."

---

## Next Steps
[REQUIRED: Numbered list of immediate next actions]

Example:
1. Complete refresh token endpoint implementation
2. Add unit tests for token validation
3. Integrate auth flow with frontend
4. Request security review
5. Update API documentation

---

## Key Artifacts
[OPTIONAL: Important code snippets, commands, or references]

Example:
```typescript
// Token validation helper (for reference)
export async function validateToken(token: string): Promise<User | null> {
  // ... implementation
}
```

Command to run auth tests:
```bash
npm test -- --grep "auth"
```

---

## Metadata
- **Probe Score:** [If evaluated, e.g., 95%]
- **Tokens Before:** [count]
- **Tokens After:** [count]
- **Compression Ratio:** [percentage]
```

---

## Usage Instructions

### When to Create Summary

Trigger compression when:
- Context utilization exceeds 70%
- More than 10 messages since last compression
- Before context-switching to different task

### How to Merge with Existing Summary

```python
def merge_summaries(existing: Summary, new: Summary) -> Summary:
    return Summary(
        # Preserve or update intent
        session_intent=new.session_intent or existing.session_intent,

        # Merge file modifications
        files_modified={**existing.files_modified, **new.files_modified},

        # Append decisions (dedupe)
        decisions_made=dedupe(existing.decisions_made + new.decisions_made),

        # Replace with current state
        current_state=new.current_state,

        # Replace blockers (only current ones matter)
        blockers=new.blockers,

        # Replace next steps (reflects current plan)
        next_steps=new.next_steps,

        # Append errors (preserve history)
        errors_encountered=dedupe(existing.errors_encountered + new.errors_encountered),

        # Increment metadata
        compression_count=existing.compression_count + 1
    )
```

### Validation Checklist

Before accepting a summary:
- [ ] Session intent is specific and actionable
- [ ] All modified files are listed with changes
- [ ] Decisions include rationale
- [ ] Current state reflects actual progress
- [ ] Next steps are concrete actions
- [ ] No placeholder text ("[TBD]", "etc.")

---

## Example: Filled Template

```markdown
# Session Summary
**Compression #:** 3
**Timestamp:** 2026-01-05T10:30:00Z
**Messages Compressed:** 1-45

---

## Session Intent
Implement secure file upload feature for user profile avatars with S3 storage,
image validation, and automatic resizing.

---

## Files Modified
- `src/api/upload.ts`: Created presigned URL endpoint, added file type validation
- `src/services/s3.ts`: Added S3Client wrapper, implemented getPresignedUrl
- `src/services/image.ts`: Added sharp-based resizing, created thumbnail generator
- `prisma/schema.prisma`: Added UserAvatar model with S3 key reference
- `src/api/users.ts`: Added avatar URL to user response, added updateAvatar endpoint

---

## Decisions Made
- **S3 over local storage**: Chose S3 for scalability and CDN integration
- **Presigned URLs**: Client uploads directly to S3, reduces server load
- **Sharp for resizing**: Server-side processing, creates 3 sizes (thumb, medium, full)
- **Deferred: WebP conversion**: Will add in follow-up PR for better compression

---

## Technical Context
- Using AWS SDK v3 with presigned URLs (15min expiry)
- Sharp library for image processing (installed via npm)
- Max file size: 5MB, allowed types: jpg, png, gif, webp
- S3 bucket: `myapp-avatars-prod` with CloudFront distribution

---

## Current State
- S3 integration: ✅ Complete and tested locally
- Presigned URL endpoint: ✅ Working
- Image resizing: ✅ Working (3 sizes generated)
- Database model: ✅ Migration applied
- Frontend integration: 🔄 In progress
- Tests: ❌ Need unit tests for image service

---

## Blockers / Open Questions
- Need CloudFront distribution URL from DevOps for production config
- Question: Should we keep original upload or only processed versions?

---

## Errors Encountered
- **S3 AccessDenied**: ✅ Resolved - Fixed IAM policy, added s3:PutObject
- **Sharp memory error**: ✅ Resolved - Added stream processing for large images

---

## Next Steps
1. Complete frontend upload component
2. Add unit tests for image service
3. Get CloudFront URL from DevOps
4. Add progress indicator for uploads
5. Create PR for review

---

## Key Artifacts
```typescript
// Presigned URL generation (for reference)
const command = new PutObjectCommand({
  Bucket: 'myapp-avatars-prod',
  Key: `avatars/${userId}/${filename}`,
  ContentType: contentType,
});
const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
```

---

## Metadata
- **Probe Score:** 94%
- **Tokens Before:** 12,500
- **Tokens After:** 1,200
- **Compression Ratio:** 90.4%
```
