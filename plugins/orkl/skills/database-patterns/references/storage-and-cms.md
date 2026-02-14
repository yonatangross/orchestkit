# Storage and CMS Database Selection

Guidance for choosing databases in content management and file storage contexts.

## CMS Backend Database Selection

| CMS Type | Recommended Database | Rationale |
|----------|---------------------|-----------|
| Traditional CMS (WordPress-like) | PostgreSQL | Structured content with relationships, taxonomies, user roles |
| Headless CMS (API-first) | PostgreSQL | Content types, versioning, localization all benefit from relational model |
| Blog / Documentation | PostgreSQL or SQLite | Simple schema; SQLite works for single-author static-gen |
| E-commerce catalog | PostgreSQL | Products, variants, inventory, orders — heavily relational |
| User-generated content | PostgreSQL | Moderation workflows, reporting, search — needs JOINs and transactions |

### Why Not MongoDB for CMS?

The "documents for content" intuition is wrong. CMS content is deeply relational:

- Content references other content (related posts, linked products)
- Taxonomies (categories, tags) are many-to-many relationships
- User roles and permissions are relational
- Content versioning needs transactions
- Localization multiplies content with locale relationships

PostgreSQL JSONB handles the flexible parts (custom fields, metadata) while maintaining relational integrity for the structural parts.

## File and Blob Storage

**Rule: Never store large files in a database.**

| Storage Type | Use | Technology |
|-------------|-----|------------|
| File metadata | Database (PostgreSQL) | Store filename, size, mime type, S3 key, upload timestamp |
| Small files (< 1 MB) | Database acceptable | Profile avatars, thumbnails — `BYTEA` column or JSONB base64 |
| Medium files (1-100 MB) | Object storage | S3, GCS, R2, MinIO — store URL/key in database |
| Large files (100 MB+) | Object storage + multipart | S3 multipart upload, presigned URLs |
| Temporary files | Object storage with lifecycle | S3 lifecycle rules for auto-deletion |

### Recommended Architecture

```
User Upload --> API Server --> Object Storage (S3/R2/GCS)
                    |
                    v
              PostgreSQL (metadata only)
              - file_id, s3_key, filename
              - mime_type, size_bytes
              - uploaded_by, uploaded_at
```

This pattern:
- Keeps database small and fast (metadata only)
- Leverages CDN for file delivery (CloudFront, Cloudflare)
- Enables presigned URLs for direct upload/download (bypasses API server)
- Works with any object storage provider (no vendor lock-in)

### When to Use Database for Storage

Acceptable cases for storing data directly in PostgreSQL:

1. **Small, frequently accessed blobs**: User avatars under 100 KB, stored as `BYTEA`
2. **Generated documents**: PDF invoices, reports — if total volume is small (< 10 GB)
3. **Configuration files**: YAML/JSON configs under 1 MB
4. **Embedded SQLite**: Single-user apps where adding object storage is overkill

### Object Storage Comparison

| Provider | Free Tier | Cost (per GB/mo) | Egress | Best For |
|----------|-----------|-------------------|--------|----------|
| Cloudflare R2 | 10 GB | $0.015 | Free | Cost-sensitive, no egress fees |
| AWS S3 | 5 GB (12 months) | $0.023 | $0.09/GB | AWS ecosystem, mature tooling |
| GCS | 5 GB | $0.020 | $0.12/GB | GCP ecosystem |
| MinIO | Unlimited (self-hosted) | Infrastructure cost | N/A | On-premise, air-gapped |
| Supabase Storage | 1 GB | $0.021 | Included in plan | Already using Supabase |

**Default recommendation**: Cloudflare R2 for new projects (zero egress fees), S3 for AWS-native stacks.
