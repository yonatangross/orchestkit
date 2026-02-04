# OWASP Top 10 - Vulnerable vs Secure Code

Real examples showing vulnerable code and their secure alternatives.

## A01: Broken Access Control

### ❌ Vulnerable: Direct Object Reference
```python
@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int):
    # Anyone can access any document by guessing IDs
    return db.query(Document).get(doc_id)
```

### ✅ Secure: Authorization Check
```python
@app.get("/api/documents/{doc_id}")
def get_document(doc_id: int, current_user: User = Depends(get_current_user)):
    doc = db.query(Document).get(doc_id)
    if doc.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(403, "Access denied")
    return doc
```

## A02: Cryptographic Failures

### ❌ Vulnerable: Weak Hashing
```python
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()
```

### ✅ Secure: Modern Password Hashing
```python
from passlib.hash import argon2
password_hash = argon2.hash(password)
# Verify: argon2.verify(password, password_hash)
```

## A03: Injection

### ❌ Vulnerable: SQL Injection
```python
query = f"SELECT * FROM users WHERE name = '{name}'"
cursor.execute(query)  # name = "'; DROP TABLE users; --"
```

### ✅ Secure: Parameterized Query
```python
cursor.execute("SELECT * FROM users WHERE name = %s", (name,))
# Or with ORM:
db.query(User).filter(User.name == name).first()
```

### ❌ Vulnerable: Command Injection
```python
import os
os.system(f"convert {filename} output.png")  # filename = "; rm -rf /"
```

### ✅ Secure: Use subprocess with list args
```python
import subprocess
subprocess.run(["convert", filename, "output.png"], check=True)
```

## A05: Security Misconfiguration

### ❌ Vulnerable: Debug in Production
```python
app = Flask(__name__)
app.run(debug=True)  # Exposes debugger, allows code execution
```

### ✅ Secure: Environment-based Config
```python
app = Flask(__name__)
app.run(debug=os.getenv("FLASK_ENV") == "development")
```

### ❌ Vulnerable: CORS Allow All
```python
CORS(app, origins="*", allow_credentials=True)
```

### ✅ Secure: Explicit Origins
```python
CORS(app, origins=["https://app.example.com"], allow_credentials=True)
```

## A07: XSS (Cross-Site Scripting)

### ❌ Vulnerable: Unescaped Output
```javascript
element.innerHTML = userInput;  // userInput = "<script>stealCookies()</script>"
```

### ✅ Secure: Text Content or Sanitization
```javascript
element.textContent = userInput;  // Automatically escaped
// Or with sanitization:
element.innerHTML = DOMPurify.sanitize(userInput);
```

### React (Safe by Default)
```jsx
// ✅ Safe - React escapes by default
<div>{userInput}</div>

// ❌ Dangerous - explicitly bypasses escaping
<div dangerouslySetInnerHTML={{__html: userInput}} />
```

## A08: Insecure Deserialization

### ❌ Vulnerable: Pickle from Untrusted Source
```python
import pickle
data = pickle.loads(user_input)  # Can execute arbitrary code
```

### ✅ Secure: Use JSON
```python
import json
data = json.loads(user_input)  # Only parses data, no code execution
```

## Quick Reference

| Vulnerability | Fix |
|--------------|-----|
| SQL Injection | Parameterized queries, ORM |
| XSS | Escape output, CSP headers |
| CSRF | CSRF tokens, SameSite cookies |
| Auth bypass | Check permissions every request |
| Secrets in code | Environment variables, vault |
| Weak crypto | Argon2/bcrypt, TLS 1.3, AES-256-GCM |
