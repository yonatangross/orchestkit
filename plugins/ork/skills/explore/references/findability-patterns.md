# Findability Patterns

Improve code discoverability for developers exploring the codebase.

## Naming Conventions for Searchability

| Pattern | Example | Searchability |
|---------|---------|---------------|
| Domain prefix | `auth_login()`, `auth_logout()` | Grep "auth_" finds all |
| Feature suffix | `UserService`, `UserRepository` | Grep "User" finds related |
| Action verbs | `create_user`, `delete_order` | Grep "create_" finds patterns |
| Consistent pluralization | `users/`, `orders/` | Predictable directory names |

**Anti-Patterns:**
- Abbreviations: `usr`, `mgr`, `svc` (hard to search)
- Generic names: `utils.py`, `helpers.js` (too broad)
- Inconsistent casing: `getUserData`, `get_user_data`

---

## Documentation Placement

| Location | Purpose | Findability |
|----------|---------|-------------|
| `README.md` in directory | Module overview | First thing developers see |
| Inline docstrings | Function behavior | IDE tooltips, grep |
| `docs/architecture/` | System design | High-level understanding |
| `CLAUDE.md` / `CONTRIBUTING.md` | Development guide | Onboarding entry |

**Entry Point Strategy:**
1. Every directory should have a README or index
2. Complex modules need architecture diagrams
3. Public APIs need usage examples
4. Workflows need sequence diagrams

---

## Module Organization

### Vertical Slice Architecture

```
features/
  auth/
    api.py          # Entry point
    service.py      # Business logic
    repository.py   # Data access
    models.py       # Domain models
    tests/          # Co-located tests
```

**Benefits:**
- Related code together
- Easy to find all auth-related files
- Clear boundaries

### Horizontal Layer Architecture

```
api/
  auth.py
  users.py
services/
  auth.py
  users.py
```

**Benefits:**
- Technical cohesion
- Easier cross-cutting concerns

---

## Improving Discoverability

### Quick Wins

1. **Add index files**: Export public API from `__init__.py` or `index.ts`
2. **Use consistent prefixes**: `handle_`, `on_`, `create_`, `get_`
3. **Create README per directory**: Brief purpose + key files
4. **Tag with keywords**: Add searchable comments for concepts

### Search Optimization

```python
# Keywords: authentication, login, JWT, OAuth, session
# See also: user_service.py, token_handler.py
```

**Metadata in Files:**
- Related files cross-reference
- Alternative terms for the concept
- Links to documentation
