# Access Control Patterns

RBAC patterns, field-level access, and admin vs API access for Payload CMS 3.0.

## Access Function Signature

Every access function receives context and returns `boolean` or a **query constraint**.

```typescript
import { Access } from 'payload'

// Simple boolean — allow or deny
const isAuthenticated: Access = ({ req: { user } }) => Boolean(user)

// Query constraint — Payload auto-filters results
const isOwner: Access = ({ req: { user } }) => {
  if (!user) return false
  return { createdBy: { equals: user.id } }
}
```

Returning a query object is the most powerful pattern — Payload appends it to the database query automatically, so users only ever see their own data.

## Role-Based Access Control

```typescript
// Define roles on user collection
const Users: CollectionConfig = {
  slug: 'users',
  auth: true,  // Enables authentication
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'editor', 'viewer'],
      required: true,
      defaultValue: 'viewer',
    },
  ],
}

// Reusable access helpers
const isAdmin: Access = ({ req: { user } }) => user?.role === 'admin'

const isEditorOrAbove: Access = ({ req: { user } }) =>
  ['admin', 'editor'].includes(user?.role)

// Composite: admin sees all, editor sees own, viewer sees published
const postAccess: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'editor') {
    return { author: { equals: user.id } }
  }
  // Viewer / anonymous — only published
  return { status: { equals: 'published' } }
}
```

## Collection-Level Access

```typescript
const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: postAccess,            // Who can list/get
    create: isEditorOrAbove,     // Who can create
    update: isAdminOrAuthor,     // Who can update
    delete: isAdmin,             // Who can delete
  },
}
```

Each operation (`read`, `create`, `update`, `delete`) is independent. Omitting one defaults to allowing authenticated users.

## Field-Level Access

Hide or protect individual fields based on role.

```typescript
{
  name: 'internalNotes',
  type: 'textarea',
  access: {
    read: isAdmin,     // Hidden from API response for non-admins
    update: isAdmin,   // Not editable by non-admins
    create: isAdmin,   // Cannot be set on creation by non-admins
  },
}
```

Field-level access applies to both the REST/GraphQL API and the admin panel — fields are completely invisible to unauthorized users.

## Admin Panel vs API Access

Access control applies uniformly, but you can distinguish context:

```typescript
const adminOnlyInPanel: Access = ({ req }) => {
  // req.user is available in both contexts
  // req.headers can distinguish admin panel requests
  if (req.user?.role === 'admin') return true
  return false
}
```

**Important:** The Local API (`payload.find()`) bypasses access control by default. Pass `overrideAccess: false` when calling from user-facing server code:

```typescript
// In a Next.js server component — MUST enforce access
const posts = await payload.find({
  collection: 'posts',
  overrideAccess: false,  // Enforce access control
  user: req.user,         // Pass the current user
})
```

## Multi-Tenant Access

Isolate data between tenants using query constraints.

```typescript
const tenantAccess: Access = ({ req: { user } }) => {
  if (user?.role === 'super-admin') return true
  if (!user?.tenant) return false
  return { tenant: { equals: user.tenant } }
}

// Apply to every collection that is tenant-scoped
const TenantPosts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: tenantAccess,
    create: tenantAccess,
    update: tenantAccess,
    delete: tenantAccess,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true },
    // ... other fields
  ],
}
```

## Common Access Patterns Summary

| Pattern | Returns | Use Case |
|---------|---------|----------|
| `() => true` | boolean | Public read |
| `({ req }) => Boolean(req.user)` | boolean | Authenticated only |
| `({ req }) => req.user?.role === 'admin'` | boolean | Admin only |
| `({ req }) => ({ author: { equals: req.user?.id } })` | query | Row-level security |
| `({ req }) => ({ tenant: { equals: req.user?.tenant } })` | query | Multi-tenant isolation |
