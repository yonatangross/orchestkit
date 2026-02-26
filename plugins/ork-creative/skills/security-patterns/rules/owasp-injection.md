---
title: Prevent SQL, command, and SSRF injection with parameterized queries and input validation
category: owasp
impact: CRITICAL
impactDescription: "Prevents SQL, command, and SSRF injection attacks through parameterized queries and input validation"
tags: sql-injection, command-injection, ssrf, idor, owasp
---

# Injection Prevention

## SQL Injection

**Vulnerable — user input directly interpolated into query:**
```python
# VULNERABLE: User input directly in query
query = f"SELECT * FROM users WHERE email = '{email}'"
```

**Safe — parameterized query and ORM:**
```python
# SAFE: Parameterized query
query = "SELECT * FROM users WHERE email = ?"
db.execute(query, [email])

# SAFE: ORM
db.query(User).filter(User.name == name).first()
```

## SQL Injection Attack Demo

**Vulnerable — f-string interpolation allows injection payload:**
```python
# Vulnerable endpoint
@app.get("/users/search")
def search_users(username: str = Query(...)):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor.execute(query)
    return cursor.fetchall()

# Attack payload: username = "' OR '1'='1' --"
# Resulting query: SELECT * FROM users WHERE username = '' OR '1'='1' --'
# Returns ALL users
```

**Safe — parameterized query prevents injection:**
```python
@app.get("/users/search")
def search_users(username: str = Query(..., min_length=1, max_length=50)):
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    return cursor.fetchall()
```

## Command Injection

```python
# VULNERABLE: User input in shell command
import os
os.system(f"convert {filename} output.png")  # filename = "; rm -rf /"

# SAFE: subprocess with list args
import subprocess
subprocess.run(["convert", filename, "output.png"], check=True)
```

## SSRF (Server-Side Request Forgery)

```python
# VULNERABLE: Fetch any URL
response = requests.get(user_provided_url)

# SAFE: Allowlist domains
ALLOWED = ['api.example.com']
if urlparse(url).hostname not in ALLOWED:
    abort(400)
response = requests.get(url)
```

## Broken Access Control (IDOR)

```python
# VULNERABLE: No authorization check
@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int):
    return db.query(Document).get(doc_id)  # Anyone can access any doc

# SAFE: Authorization check
@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, current_user: User = Depends(get_current_user)):
    doc = db.query(Document).get(doc_id)
    if doc.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Access denied")
    return doc
```

## Cryptographic Failures

```python
# VULNERABLE: Weak hashing
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()

# SAFE: Modern password hashing
from argon2 import PasswordHasher
ph = PasswordHasher()
password_hash = ph.hash(password)
```

## Insecure Deserialization

```python
# VULNERABLE: Pickle from untrusted source
import pickle
data = pickle.loads(user_input)  # Can execute arbitrary code

# SAFE: Use JSON
import json
data = json.loads(user_input)  # Only parses data
```

## Detection Commands

```bash
# Detect SQL injection patterns
grep -rn "f\"SELECT\|f\"INSERT\|f\"UPDATE\|f\"DELETE" --include="*.py" .
bandit -r . -t B608

# Detect command injection
semgrep --config "p/python-security-audit" .

# Detect SSRF
grep -rn "requests.get\|urllib.urlopen" --include="*.py" .
```

**Incorrect — interpolating user input directly into SQL query:**
```python
query = f"SELECT * FROM users WHERE email = '{email}'"
cursor.execute(query)
```

**Correct — using parameterized query to prevent injection:**
```python
cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
```

## Quick Reference

| Vulnerability | Fix |
|--------------|-----|
| SQL Injection | Parameterized queries, ORM |
| Command Injection | subprocess with list args |
| SSRF | URL domain allowlist |
| IDOR | Authorization check on every endpoint |
| Weak crypto | Argon2/bcrypt, not MD5/SHA1 |
| Insecure deserialization | JSON, not pickle |
