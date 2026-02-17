---
title: Resource Modeling
impact: HIGH
impactDescription: "Proper resource modeling determines API discoverability and usability — flat structures and missing filters force clients into multiple round-trips"
tags: resource-modeling, filtering, sorting, field-selection, hierarchical
---

## Resource Modeling

Patterns for modeling API resources with hierarchical relationships, filtering, sorting, and field selection.

**Hierarchical Relationships:**

```
# Express ownership and containment through URL hierarchy
GET /api/v1/analyses/{analysis_id}/artifact
GET /api/v1/teams/{team_id}/members
POST /api/v1/projects/{project_id}/tasks

# NOT query params for primary relationships
GET /api/v1/artifact?analysis_id={id}      # Avoid
GET /api/v1/analysis_artifact/{id}          # Avoid
```

**Query Parameter Filtering:**

```python
@router.get("/analyses")
async def list_analyses(
    status: str | None = None,
    content_type: str | None = None,
    created_after: datetime | None = None,
    created_before: datetime | None = None,
) -> list[AnalysisResponse]:
    filters = {}
    if status:
        filters["status"] = status
    if content_type:
        filters["content_type"] = content_type
    return await repo.find_all(filters=filters)
```

**Usage:**
```
GET /api/v1/analyses?status=completed&content_type=article
GET /api/v1/analyses?created_after=2025-01-01&created_before=2025-12-31
```

**Sorting:**

```python
@router.get("/analyses")
async def list_analyses(
    sort: str = Query(default="-created_at"),
) -> list[AnalysisResponse]:
    direction = "desc" if sort.startswith("-") else "asc"
    field = sort.lstrip("-")
    return await repo.find_all(order_by=field, direction=direction)
```

**Usage:**
```
GET /api/v1/analyses?sort=-created_at       # Newest first
GET /api/v1/analyses?sort=title             # Alphabetical
```

**Field Selection (Sparse Fieldsets):**

```python
@router.get("/analyses")
async def list_analyses(
    fields: str | None = None,
) -> list[dict[str, Any]]:
    selected_fields = fields.split(",") if fields else None
    results = await repo.find_all()

    if selected_fields:
        return [
            {k: v for k, v in item.dict().items() if k in selected_fields}
            for item in results
        ]
    return results
```

**Usage:**
```
GET /api/v1/analyses?fields=id,title,status
```

**GraphQL Connection Pattern (for GraphQL APIs):**

```graphql
type Query {
  users(first: Int, after: String): UserConnection!
}

type UserConnection {
  edges: [UserEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

**Best Practices:**

```python
# Empty collections: Return empty array, not null
{"data": []}   # Correct
{"data": null}  # Wrong

# Deleted resources: Return 404, not null
# 404 Not Found (correct)
# {"data": null} (wrong)

# Null fields: Be explicit
{"title": null, "description": ""}  # Clear intent
```

**Incorrect — Flat URLs with query params for hierarchy:**
```typescript
// Parent relationship in query param
GET /api/v1/artifacts?analysis_id=abc-123
```

**Correct — Hierarchical URLs:**
```typescript
// Express ownership in URL structure
GET /api/v1/analyses/abc-123/artifacts
```

**Key rules:**
- Use hierarchical URLs for parent-child relationships
- Support filtering via query parameters on list endpoints
- Use `-field` prefix for descending sort order
- Return empty arrays (not null) for empty collections
- Provide field selection for bandwidth optimization
