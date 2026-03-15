---
title: "Sharing & Collaboration"
impact: MEDIUM
impactDescription: "Sharing notebooks without checking status can expose sensitive content publicly"
tags: [sharing, collaboration, access-control]
---

## Sharing & Collaboration

Control notebook access with sharing tools. Always check current sharing status before modifying access -- public links expose all notebook content.

**Incorrect -- sharing publicly without reviewing content:**
```
# Dangerous: makes everything in the notebook publicly accessible
notebook_share_public(notebook_id="...", enabled=true)
# Notebook contains internal security advisories -- now exposed
```

**Correct -- check status, review, then share deliberately:**
```
# 1. Check current sharing settings
status = notebook_share_status(notebook_id="...")
# Shows: public link (on/off), list of collaborators, permission levels

# 2. Review notebook content for sensitive material
notebook_query(notebook_id="...", query="Does this notebook contain credentials or internal secrets?")

# 3a. Share with specific collaborators (preferred)
notebook_share_invite(
    notebook_id="...",
    email="colleague@company.com",
    role="reader"  # or "editor"
)

# 3b. Or enable public link (use with caution)
notebook_share_public(notebook_id="...", enabled=true)
```

**Batch sharing — invite multiple collaborators at once:**
```
# Single call for multiple invites with mixed roles
notebook_share_batch(
    notebook_id="...",
    invitations=[
        {"email": "dev@company.com", "role": "editor"},
        {"email": "pm@company.com", "role": "reader"},
        {"email": "lead@company.com", "role": "editor"}
    ],
    confirm=True
)
```

**Key rules:**
- Always call `notebook_share_status` before modifying sharing settings
- Prefer `notebook_share_invite` (or `notebook_share_batch` for multiple) over public links
- Review notebook content for sensitive material before enabling public access
- Use `role="reader"` by default -- only grant `"editor"` when collaboration is needed
- Use `notebook_share_batch` for 3+ collaborators -- single API call vs. multiple invites
- Disable public links when no longer needed: `notebook_share_public(enabled=false)`
