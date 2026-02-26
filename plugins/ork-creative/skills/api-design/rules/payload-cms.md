---
title: Configure Payload CMS 3.0 collections and access control patterns for Next.js
category: integration
impact: HIGH
impactDescription: Payload CMS 3.0 is tightly integrated with Next.js — wrong collection design or access control patterns create security gaps and performance issues that are hard to refactor.
tags: [payload, cms, headless-cms, sanity, content-management, collections, nextjs]
---

# Payload CMS 3.0 Patterns

## CMS Selection Decision Tree

| Factor | Payload | Sanity | Strapi |
|--------|---------|--------|--------|
| Runtime | Next.js (self-hosted) | Hosted (GROQ API) | Node.js (self-hosted) |
| TypeScript | First-class, generated types | Plugin-based | Partial |
| Data ownership | Full (your DB) | Sanity cloud | Full (your DB) |
| Admin UI | Customizable React | Sanity Studio | Built-in |
| Best for | Next.js apps, developer-owned | Content teams, editorial | REST-first APIs |

**Choose Payload when**: Next.js project, need full data ownership, developer-first workflow.
**Choose Sanity when**: Content-heavy editorial teams, need hosted GROQ API, real-time collaboration.

## Collection Design

```typescript
// Payload 3.0 collection config
import type { CollectionConfig } from "payload";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: { useAsTitle: "title" },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => user?.role === "admin",
    delete: ({ req: { user } }) => user?.role === "admin",
  },
  fields: [
    { name: "title", type: "text", required: true },
    { name: "content", type: "richText" },
    { name: "author", type: "relationship", relationTo: "users" },
    { name: "status", type: "select", options: ["draft", "published"] },
  ],
  hooks: {
    beforeChange: [({ data }) => ({ ...data, updatedAt: new Date() })],
  },
};
```

## Access Control Patterns

- **Collection-level**: `read`, `create`, `update`, `delete` functions
- **Field-level**: Per-field `access` for sensitive data
- **Role-based**: Check `user.role` in access functions
- **Local API**: Uses `overrideAccess: true` by default — be explicit when calling from server

## Anti-Patterns

**Incorrect:**
- Using Local API without `overrideAccess: false` in user-facing code — bypasses all access control
- Putting business logic in hooks instead of service layer — untestable
- Storing large files in the database — use S3/R2 upload adapter

**Correct:**
- Always set `overrideAccess: false` in API routes that serve user requests
- Keep hooks thin — validate/transform only, delegate to services
- Configure upload collections with S3-compatible storage adapter

## References

- `references/payload-collection-design.md` — Field types, relationships, blocks, validation
- `references/payload-access-control.md` — RBAC patterns, field-level, multi-tenant
- `references/payload-vs-sanity.md` — Detailed comparison, decision matrix, migration paths
