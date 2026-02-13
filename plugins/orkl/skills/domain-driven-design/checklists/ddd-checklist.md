# Domain-Driven Design Checklist

## Strategic Design

### Bounded Contexts
- [ ] Domain boundaries identified and documented
- [ ] Context map shows relationships (ACL, Shared Kernel, etc.)
- [ ] Each context has clear ownership
- [ ] Ubiquitous language defined per context
- [ ] Integration patterns chosen (events, API, shared DB)

### Ubiquitous Language
- [ ] Domain terms documented in glossary
- [ ] Code uses domain terminology (not technical jargon)
- [ ] Team (dev + domain experts) agrees on terms
- [ ] Terms are context-specific (not global)

## Tactical Design

### Entities
- [ ] Identified by unique ID (prefer UUIDv7)
- [ ] Equality based on ID, not attributes
- [ ] Contains business logic (not anemic)
- [ ] State changes through methods, not setters
- [ ] Domain events emitted for significant changes
- [ ] PostgreSQL 18: Using `gen_random_uuid_v7()` for IDs

### Value Objects
- [ ] Immutable (`frozen=True` in dataclass)
- [ ] Equality based on all attributes
- [ ] Self-validating in `__post_init__`
- [ ] No identity (no ID field)
- [ ] Operations return new instances

### Aggregates
- [ ] Aggregate root identified
- [ ] All access through aggregate root
- [ ] Invariants enforced within aggregate
- [ ] References to other aggregates by ID only
- [ ] Sized appropriately (not too large)

### Repositories
- [ ] Interface defined in domain layer (Protocol)
- [ ] Implementation in infrastructure layer
- [ ] Returns domain entities (not ORM models)
- [ ] Domain-specific query methods
- [ ] Unit of Work for transaction management

### Domain Events
- [ ] Events are immutable (frozen dataclass)
- [ ] Events named in past tense (OrderPlaced, not PlaceOrder)
- [ ] Events contain IDs, not full entities
- [ ] Collection on entity, publishing in service layer
- [ ] UUIDv7 for time-ordered event IDs

### Domain Services
- [ ] Used for cross-entity operations
- [ ] Stateless
- [ ] Named with domain verbs (not technical)
- [ ] Coordinates entities, doesn't replace their logic

## Layer Architecture

### Domain Layer
- [ ] No infrastructure dependencies
- [ ] Entities, value objects, domain events
- [ ] Repository interfaces (Protocols)
- [ ] Domain services

### Application Layer
- [ ] Use cases / application services
- [ ] Transaction management (Unit of Work)
- [ ] Event publishing
- [ ] DTO mapping

### Infrastructure Layer
- [ ] Repository implementations
- [ ] ORM models and mapping
- [ ] External service clients
- [ ] Anti-corruption layers

### Presentation Layer
- [ ] API routes/controllers
- [ ] Input validation (Pydantic)
- [ ] Response formatting
- [ ] No business logic

## Code Quality

### Naming
- [ ] Classes named with domain terms
- [ ] Methods use domain verbs
- [ ] No technical jargon in domain layer
- [ ] Consistent with ubiquitous language

### Testing
- [ ] Domain logic unit tested
- [ ] Repository implementations tested
- [ ] Application services integration tested
- [ ] Domain events verified

### Anti-Patterns Avoided
- [ ] No anemic domain model
- [ ] No business logic in controllers
- [ ] No ORM models in domain layer
- [ ] No circular dependencies between contexts
- [ ] No UUIDv4 (use UUIDv7 for time-ordering)

## PostgreSQL 18 Specifics

### UUIDv7 Usage
- [ ] `gen_random_uuid_v7()` as column default
- [ ] Python: `uuid_utils.uuid7()` for app-generated IDs
- [ ] Index on ID serves as ~created_at index
- [ ] No separate created_at index needed for sorting

### Performance
- [ ] UUIDv7 reduces index fragmentation
- [ ] Recent records clustered together
- [ ] Better cache locality for recent queries
