# Collection Design Patterns

Field types, relationships, blocks, tabs, and validation patterns for Payload CMS 3.0.

## Field Types Quick Reference

| Type | Use Case | Key Options |
|------|----------|-------------|
| `text` | Short strings | `minLength`, `maxLength`, `unique` |
| `textarea` | Multi-line text | `minLength`, `maxLength` |
| `richText` | Formatted content | Lexical editor (default in 3.0) |
| `number` | Integers/floats | `min`, `max`, `hasMany` |
| `select` | Enum values | `options`, `hasMany` |
| `relationship` | Foreign key | `relationTo`, `hasMany`, `filterOptions` |
| `upload` | Media reference | `relationTo` (upload collection) |
| `blocks` | Polymorphic content | `blocks` array of block configs |
| `array` | Repeatable groups | `fields` (nested field config) |
| `group` | Nested object | `fields` (no separate collection) |
| `tabs` | UI organization | `tabs` array with `fields` per tab |
| `date` | Timestamps | `admin.date` config |
| `checkbox` | Boolean flags | Default `false` |
| `json` | Arbitrary JSON | Use sparingly — no admin UI |

## Relationship Patterns

```typescript
// One-to-many: Post has one author
{ name: 'author', type: 'relationship', relationTo: 'users', required: true }

// Many-to-many: Post has multiple tags
{ name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true }

// Polymorphic: Link to different collection types
{
  name: 'relatedContent',
  type: 'relationship',
  relationTo: ['posts', 'pages', 'products'],  // Union type
  hasMany: true,
}

// Filtered relationship: Only show published posts
{
  name: 'featuredPost',
  type: 'relationship',
  relationTo: 'posts',
  filterOptions: { status: { equals: 'published' } },
}
```

## Block Patterns (Polymorphic Content)

Blocks are the key pattern for flexible page layouts — each block is a typed content section.

```typescript
import { Block } from 'payload'

const HeroBlock: Block = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'ctaText', type: 'text' },
    { name: 'ctaLink', type: 'text' },
  ],
}

const ContentBlock: Block = {
  slug: 'content',
  fields: [
    { name: 'body', type: 'richText' },
    { name: 'width', type: 'select', options: ['full', 'narrow', 'wide'], defaultValue: 'full' },
  ],
}

// Use in collection
{
  name: 'layout',
  type: 'blocks',
  blocks: [HeroBlock, ContentBlock, CTABlock, TestimonialBlock],
}
```

## Tabs for Complex Collections

```typescript
const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'richText' },
          ],
        },
        {
          label: 'Pricing',
          fields: [
            { name: 'price', type: 'number', required: true },
            { name: 'currency', type: 'select', options: ['USD', 'EUR', 'GBP'] },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { name: 'metaTitle', type: 'text' },
            { name: 'metaDescription', type: 'textarea' },
          ],
        },
      ],
    },
  ],
}
```

## Validation Patterns

```typescript
// Custom field validation
{
  name: 'slug',
  type: 'text',
  unique: true,
  validate: (value) => {
    if (!/^[a-z0-9-]+$/.test(value)) {
      return 'Slug must be lowercase alphanumeric with hyphens only'
    }
    return true
  },
}

// Conditional required — required only when status is published
{
  name: 'publishedDate',
  type: 'date',
  admin: {
    condition: (data) => data.status === 'published',
  },
  validate: (value, { siblingData }) => {
    if (siblingData.status === 'published' && !value) {
      return 'Published date is required for published content'
    }
    return true
  },
}
```

## Global Config (Singletons)

Use globals for site-wide settings that don't need multiple documents.

```typescript
import { GlobalConfig } from 'payload'

const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: { read: () => true, update: isAdmin },
  fields: [
    { name: 'siteName', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'socialLinks', type: 'array', fields: [
      { name: 'platform', type: 'select', options: ['twitter', 'github', 'linkedin'] },
      { name: 'url', type: 'text' },
    ]},
  ],
}
```
