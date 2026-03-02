# Anti-Pattern Warnings

Avoid these known anti-patterns:

- **offset pagination**: Offset pagination causes performance issues on large tables. Use cursor-based pagination instead.
- **manual jwt validation**: Manual JWT validation is error-prone. Use established libraries like python-jose or jsonwebtoken.
- **storing passwords in plaintext**: Never store passwords in plaintext. Use bcrypt, argon2, or scrypt.
- **global state**: Global mutable state causes testing and concurrency issues. Use dependency injection.
- **synchronous file operations**: Synchronous file I/O blocks the event loop. Use async file operations.
- **n+1 query**: N+1 queries cause performance problems. Use eager loading or batch queries.
- **polling for real-time**: Polling is inefficient for real-time updates. Consider SSE or WebSocket.
