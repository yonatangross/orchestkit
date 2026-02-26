---
title: "Validation: Output Encoding & XSS Prevention"
category: validation
impact: HIGH
impactDescription: "Prevents XSS attacks through proper HTML sanitization, output encoding, and security headers"
tags: xss-prevention, output-encoding, dompurify, security-headers
---

# Output Encoding & XSS Prevention

## HTML Sanitization (Python)

```python
from markupsafe import escape

@app.route('/comment', methods=['POST'])
def create_comment():
    content = escape(request.form['content'])
    db.execute("INSERT INTO comments (content) VALUES (?)", [content])
```

## HTML Sanitization (JavaScript)

```typescript
import DOMPurify from 'dompurify';

// Sanitize HTML input with allowed tags
const sanitizedHtml = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
  ALLOWED_ATTR: ['href'],
});
```

## XSS Prevention

**Safe — textContent and React auto-escaping:**
```javascript
// SAFE: textContent escapes HTML entities
element.textContent = userInput;

// React is safe by default
<div>{userInput}</div>  // Auto-escaped
```

**Dangerous — innerHTML and dangerouslySetInnerHTML bypass escaping:**
```javascript
// DANGEROUS: innerHTML can execute scripts
element.innerHTML = userInput;  // NEVER do this with user input

// DANGEROUS: bypasses React escaping
<div dangerouslySetInnerHTML={{__html: userInput}} />
```

## Server-Side XSS Prevention (Flask)

```python
from flask import request, render_template_string
from markupsafe import escape

@app.route('/greet')
def greet():
    name = request.args.get('name', '')
    return f"<h1>Hello, {escape(name)}!</h1>"

# Or use Jinja2 templates (auto-escape by default)
@app.route('/greet-template')
def greet_template():
    return render_template_string(
        "<h1>Hello, {{ name }}!</h1>",
        name=request.args.get('name', '')
    )
```

## Security Headers

```python
SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": "default-src 'self'",
}

@app.after_request
def add_security_headers(response):
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response
```

## SRI for CDN Scripts

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

## Anti-Patterns

```javascript
// NEVER use innerHTML with user input
element.innerHTML = userInput;

// NEVER use dangerouslySetInnerHTML without sanitization
<div dangerouslySetInnerHTML={{__html: userInput}} />

// NEVER trust Content-Type header for file validation
if (file.type === 'image/png') {...}  // Can be spoofed

// ALWAYS use textContent or DOMPurify
element.textContent = userInput;
const safe = DOMPurify.sanitize(userInput);
```

**Incorrect — Using innerHTML with user content allows XSS script injection:**
```javascript
const userComment = "<script>alert('XSS')</script>";
element.innerHTML = userComment;
// Script executes, stealing cookies/tokens
```

**Correct — Using textContent automatically escapes HTML and prevents XSS:**
```javascript
const userComment = "<script>alert('XSS')</script>";
element.textContent = userComment;
// Renders as plain text: "<script>alert('XSS')</script>"
```
