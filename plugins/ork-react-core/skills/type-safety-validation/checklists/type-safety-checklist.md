# Type Safety Checklist

Comprehensive checklist for implementing end-to-end type safety in TypeScript applications.

## Schema Definition

### Zod Schema Design
- [ ] Define schemas for all API request/response types
- [ ] Create reusable base schemas (email, UUID, URL, etc.)
- [ ] Use `.infer` to generate TypeScript types from schemas
- [ ] Organize schemas by domain (user, post, comment, etc.)
- [ ] Export both schemas and inferred types
- [ ] Use `satisfies` operator to ensure type compatibility
- [ ] Document complex schemas with JSDoc comments
- [ ] Create discriminated unions for polymorphic types
- [ ] Use lazy schemas for recursive types
- [ ] Define custom error messages for better UX

### TypeScript Configuration
- [ ] Enable `strict: true` in tsconfig.json
- [ ] Enable `strictNullChecks`
- [ ] Enable `strictFunctionTypes`
- [ ] Enable `noImplicitAny`
- [ ] Enable `noUncheckedIndexedAccess`
- [ ] Enable `noImplicitReturns`
- [ ] Enable `noFallthroughCasesInSwitch`
- [ ] Enable `exactOptionalPropertyTypes` (TS 5.0+)
- [ ] Set `moduleResolution` to "bundler" or "nodenext"
- [ ] Enable `isolatedModules` for build tools

### Database Schema (Prisma)
- [ ] Define all models in schema.prisma
- [ ] Add appropriate indexes for query performance
- [ ] Use relations for foreign keys
- [ ] Add `@@index` directives for common queries
- [ ] Use `@unique` constraints where appropriate
- [ ] Add `@default` values for fields
- [ ] Use `@updatedAt` for automatic timestamp updates
- [ ] Document models with triple-slash comments
- [ ] Run `prisma generate` after schema changes
- [ ] Run `prisma migrate dev` to sync database

## Validation Implementation

### Input Validation
- [ ] Validate all user inputs with Zod
- [ ] Validate environment variables at startup
- [ ] Validate API request bodies
- [ ] Validate query parameters and path params
- [ ] Validate file uploads (size, type, name)
- [ ] Validate form submissions before API calls
- [ ] Use `.safeParse()` to handle errors gracefully
- [ ] Format Zod errors for user-friendly messages
- [ ] Validate data from external APIs
- [ ] Validate data from database before use

### API Validation (tRPC)
- [ ] Define input schemas for all procedures
- [ ] Use Zod for runtime validation in `.input()`
- [ ] Return proper error codes (UNAUTHORIZED, NOT_FOUND, etc.)
- [ ] Implement authentication middleware
- [ ] Implement rate limiting middleware
- [ ] Implement logging middleware
- [ ] Use typed context for shared data
- [ ] Export `AppRouter` type for client
- [ ] Configure error formatting for Zod errors
- [ ] Use superjson for Date/Map/Set serialization

### Form Validation (React)
- [ ] Use react-hook-form with zodResolver
- [ ] Display validation errors inline
- [ ] Disable submit button during validation
- [ ] Show loading state during submission
- [ ] Handle API errors and display to user
- [ ] Implement optimistic updates where appropriate
- [ ] Reset form after successful submission
- [ ] Validate on blur for better UX
- [ ] Show field-level error messages
- [ ] Provide helpful error messages

## Type Generation

### OpenAPI/Swagger
- [ ] Generate OpenAPI spec from backend
- [ ] Use openapi-typescript to generate types
- [ ] Use openapi-zod-client to generate Zod schemas
- [ ] Automate type generation in CI/CD
- [ ] Version control generated types
- [ ] Document API endpoints in OpenAPI spec
- [ ] Include examples in OpenAPI spec
- [ ] Add security schemes to OpenAPI
- [ ] Generate client SDKs from OpenAPI
- [ ] Keep OpenAPI spec in sync with code

### Prisma Type Generation
- [ ] Run `prisma generate` in CI/CD
- [ ] Use `Prisma.validator` for reusable queries
- [ ] Use `Prisma.UserGetPayload` to extract types
- [ ] Create repository pattern for database access
- [ ] Type database transactions properly
- [ ] Use Prisma's generated types in API responses
- [ ] Extend Prisma types with computed fields
- [ ] Use `Omit`/`Pick` to create DTOs from models
- [ ] Generate Zod schemas from Prisma (zod-prisma-types)
- [ ] Keep Prisma schema as single source of truth

### Type Sharing (Monorepo)
- [ ] Define shared types in common package
- [ ] Export API contract types from backend
- [ ] Import contract types in frontend
- [ ] Use path aliases for cleaner imports
- [ ] Version shared types package
- [ ] Document breaking changes
- [ ] Use TypeScript project references
- [ ] Keep shared types package lightweight
- [ ] Avoid circular dependencies
- [ ] Test shared types in isolation

## Testing Type Safety

### Unit Tests
- [ ] Test Zod schemas with valid inputs
- [ ] Test Zod schemas with invalid inputs
- [ ] Test error message formatting
- [ ] Test transformations and refinements
- [ ] Test async validators
- [ ] Test discriminated unions
- [ ] Test recursive schemas
- [ ] Mock database responses with correct types
- [ ] Test API error handling
- [ ] Achieve >80% coverage on validators

### Integration Tests
- [ ] Test API endpoints with real HTTP calls
- [ ] Test tRPC procedures end-to-end
- [ ] Test database queries with real data
- [ ] Test authentication/authorization flows
- [ ] Test rate limiting
- [ ] Test error responses
- [ ] Test pagination (cursor and offset)
- [ ] Test file uploads
- [ ] Test SSE/WebSocket events
- [ ] Test transactions and rollbacks

### Type Tests
- [ ] Use `expectTypeOf` from vitest for type tests
- [ ] Test that inferred types match expected types
- [ ] Test that invalid types cause compile errors
- [ ] Test generic type parameters
- [ ] Test discriminated union exhaustiveness
- [ ] Test conditional types
- [ ] Test mapped types
- [ ] Use `@ts-expect-error` for negative tests
- [ ] Test branded types
- [ ] Test template literal types

## Code Quality

### Type Safety Best Practices
- [ ] Prefer `unknown` over `any`
- [ ] Use type guards for narrowing
- [ ] Use branded types for domain primitives
- [ ] Use const assertions for literal types
- [ ] Use `satisfies` to preserve literal types
- [ ] Avoid type assertions (`as`) when possible
- [ ] Use discriminated unions over plain unions
- [ ] Use exhaustive switch statements
- [ ] Leverage type inference (avoid redundant annotations)
- [ ] Use `NoInfer` to control inference direction

### Performance Optimization
- [ ] Reuse Zod schemas (don't create inline)
- [ ] Use `.parse()` for known-good data
- [ ] Use `.safeParse()` for user input
- [ ] Enable tRPC batching for multiple queries
- [ ] Cache validation results when appropriate
- [ ] Use Prisma query optimization
- [ ] Avoid N+1 queries with `include`
- [ ] Use database indexes for common queries
- [ ] Implement pagination for large datasets
- [ ] Use lazy loading for large schemas

### Error Handling
- [ ] Provide user-friendly error messages
- [ ] Log detailed errors server-side
- [ ] Send sanitized errors to client
- [ ] Use proper HTTP status codes
- [ ] Implement global error boundary (React)
- [ ] Handle network errors gracefully
- [ ] Show loading/error/success states
- [ ] Retry failed requests with exponential backoff
- [ ] Display validation errors per field
- [ ] Provide actionable error messages

## Documentation

### Code Documentation
- [ ] Document complex types with JSDoc
- [ ] Add examples to schema definitions
- [ ] Document API endpoints
- [ ] Document error codes and their meanings
- [ ] Create README for shared types
- [ ] Document migration guides
- [ ] Add inline comments for complex logic
- [ ] Generate API documentation from OpenAPI
- [ ] Keep documentation in sync with code
- [ ] Use TypeDoc for type documentation

### Developer Experience
- [ ] Set up pre-commit hooks for type checking
- [ ] Run linter in CI/CD
- [ ] Run type checker in CI/CD
- [ ] Provide helpful error messages
- [ ] Create code snippets for common patterns
- [ ] Set up VS Code settings for better DX
- [ ] Use ESLint rules for type safety
- [ ] Configure Prettier for consistent formatting
- [ ] Document common errors and solutions
- [ ] Provide example code in documentation

## Maintenance

### Regular Maintenance
- [ ] Update dependencies regularly
- [ ] Run `prisma migrate` for schema changes
- [ ] Regenerate types after backend changes
- [ ] Review and update error messages
- [ ] Audit unused types and schemas
- [ ] Refactor duplicated schemas
- [ ] Monitor bundle size of validation schemas
- [ ] Review and optimize slow validators
- [ ] Update TypeScript to latest stable version
- [ ] Keep Zod/tRPC/Prisma up to date

### Breaking Changes
- [ ] Version API endpoints
- [ ] Communicate breaking changes early
- [ ] Provide migration path
- [ ] Deprecate old endpoints before removal
- [ ] Update OpenAPI spec version
- [ ] Test backward compatibility
- [ ] Document breaking changes in CHANGELOG
- [ ] Coordinate backend/frontend deployments
- [ ] Use feature flags for gradual rollout
- [ ] Monitor errors after deployment

## Deployment

### CI/CD Pipeline
- [ ] Run type checker in CI
- [ ] Run linter in CI
- [ ] Run tests in CI
- [ ] Generate types in CI
- [ ] Build frontend in CI
- [ ] Build backend in CI
- [ ] Run Prisma migrations in CI
- [ ] Deploy with zero downtime
- [ ] Monitor deployment health
- [ ] Rollback on errors

### Production Monitoring
- [ ] Log validation errors
- [ ] Monitor API error rates
- [ ] Track response times
- [ ] Monitor database query performance
- [ ] Set up alerts for high error rates
- [ ] Track type errors in production
- [ ] Monitor bundle size
- [ ] Track Core Web Vitals
- [ ] Monitor server resource usage
- [ ] Review logs regularly for issues

---

**Progress Tracking:**
- [ ] Schema Definition: ___% complete
- [ ] Validation Implementation: ___% complete
- [ ] Type Generation: ___% complete
- [ ] Testing: ___% complete
- [ ] Documentation: ___% complete
- [ ] Overall Type Safety: ___% complete

**Target:** 100% type coverage across full stack by [DATE]
