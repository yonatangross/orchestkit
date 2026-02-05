# SOLID Principles Checklist

Use this checklist when designing or reviewing code architecture.

## Single Responsibility Principle (SRP)

- [ ] Each class has only ONE reason to change
- [ ] Class names clearly describe their single purpose
- [ ] Methods within a class are cohesive (all relate to same responsibility)
- [ ] No "Manager", "Handler", "Processor" suffix (often indicates multiple responsibilities)
- [ ] Services don't mix business logic with infrastructure concerns

**Red Flags:**
- Class imports from many unrelated modules
- Methods that don't use most class attributes
- Class has > 200 lines (usually)
- Changes to unrelated features require modifying same class

## Open/Closed Principle (OCP)

- [ ] New behavior added via new classes, not modifying existing ones
- [ ] Using Protocols/ABCs for extension points
- [ ] Strategy pattern for varying algorithms
- [ ] No switch statements on type (use polymorphism)
- [ ] Configuration over code for variation

**Red Flags:**
- Growing if/elif chains checking types
- Methods that need modification for each new feature
- Direct instantiation of concrete classes in business logic

## Liskov Substitution Principle (LSP)

- [ ] Subclasses don't strengthen preconditions (method requirements)
- [ ] Subclasses don't weaken postconditions (what method guarantees)
- [ ] Subclasses don't throw unexpected exceptions
- [ ] All Protocol methods implemented with compatible signatures
- [ ] Tests pass with any implementation of a Protocol

**Red Flags:**
- Subclass overrides method to throw NotImplementedError
- Subclass returns different types than base
- Code checks isinstance before calling methods
- Subclass ignores/overrides parent behavior unexpectedly

## Interface Segregation Principle (ISP)

- [ ] Protocols are small and focused (3-5 methods max)
- [ ] Clients don't depend on methods they don't use
- [ ] No "god interfaces" with many unrelated methods
- [ ] Role-based interfaces (IReadable, IWritable) vs. object-based
- [ ] Composition of small interfaces over large monolithic ones

**Red Flags:**
- Implementations that stub out methods with `pass` or `raise`
- Protocols with > 10 methods
- Classes implement interface but use only subset of methods
- Interface named after implementation, not capability

## Dependency Inversion Principle (DIP)

- [ ] High-level modules don't import from low-level modules
- [ ] Both depend on abstractions (Protocols)
- [ ] Abstractions don't depend on details
- [ ] Dependencies injected, not created internally
- [ ] Domain layer has zero infrastructure imports

**Red Flags:**
- `import` from infrastructure in domain/application layer
- Direct instantiation with `SomeService()` in business logic
- Hardcoded database connections, file paths, URLs
- Tests require actual database/network

## Architecture Review Checklist

### Layer Independence

- [ ] Domain layer: Zero imports from other layers
- [ ] Application layer: Imports only from Domain
- [ ] Infrastructure layer: Implements ports from Application
- [ ] API layer: Translates DTOs ↔ Domain objects

### Dependency Injection

- [ ] All dependencies passed via constructor
- [ ] No global state or singletons in business logic
- [ ] FastAPI `Depends()` used for wiring
- [ ] Test doubles easily substitutable

### Domain Purity

- [ ] Entities use dataclasses, not ORM models
- [ ] No framework imports in domain
- [ ] Value objects are immutable (`frozen=True`)
- [ ] Domain logic has no side effects (I/O)

### Testability

- [ ] Unit tests need no mocks (domain layer)
- [ ] Integration tests mock only external boundaries
- [ ] No database needed for domain logic tests
- [ ] Fast test execution (< 1 second for unit tests)

## Quick Reference

| Principle | Ask Yourself |
|-----------|--------------|
| SRP | "What is the ONE thing this class does?" |
| OCP | "Can I add new behavior without changing this code?" |
| LSP | "Can any implementation replace another safely?" |
| ISP | "Does this interface expose only what clients need?" |
| DIP | "Does this module depend on abstractions?" |

## When to Refactor

1. **Adding feature requires modifying core classes** → Extract interface, use OCP
2. **Test setup is complex** → Apply DIP, inject dependencies
3. **Class is growing large** → Apply SRP, extract classes
4. **Subclass behaves differently** → Check LSP, maybe use composition
5. **Implementing interface partially** → Apply ISP, split interface
