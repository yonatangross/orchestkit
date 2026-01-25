# GraphQL API Design

## Schema Design Principles

### Nullable by Default
```graphql
type User {
  id: ID!              # Non-null (required)
  email: String!       # Non-null
  name: String         # Nullable (optional)
  avatar: String       # Nullable
}
```

### Use Connections for Lists
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

### Input Types for Mutations
```graphql
input CreateUserInput {
  email: String!
  name: String!
  role: UserRole!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

type CreateUserPayload {
  user: User!
  errors: [UserError!]
}

type UserError {
  field: String!
  message: String!
  code: String!
}
```

## Query Design

**Fetch single resource:**
```graphql
query GetUser {
  user(id: "123") {
    id
    name
    email
    posts {
      id
      title
    }
  }
}
```

**Fetch list with filters:**
```graphql
query GetUsers {
  users(
    first: 10
    after: "cursor123"
    filter: { role: DEVELOPER, status: ACTIVE }
  ) {
    edges {
      node {
        id
        name
        email
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

## Error Handling

**Field-Level Errors:**
```graphql
type CreateUserPayload {
  user: User
  errors: [UserError!]
}
```

**Response:**
```json
{
  "data": {
    "createUser": {
      "user": null,
      "errors": [
        {
          "field": "email",
          "message": "Email is already taken",
          "code": "DUPLICATE_EMAIL"
        }
      ]
    }
  }
}
```