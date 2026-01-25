# PR Review Walkthrough Example

A complete example of reviewing a PR that adds user authentication.

## The PR

**Title:** feat(auth): Add JWT authentication middleware
**Files Changed:** 4 files (+180, -12)

### File 1: `auth/middleware.py`

```python
def authenticate_request(request):
    token = request.headers.get('Authorization')
    if not token:
        raise AuthError('Missing token')

    payload = jwt.decode(token, SECRET_KEY)  # ← Issue: No algorithm specified
    request.user = payload['user_id']
    return request
```

## Review Comments (Conventional Format)

### 1. Security Issue (Blocking)

```
🔴 **issue (security):** JWT decode without algorithm is vulnerable to algorithm confusion attacks.

An attacker could forge tokens by switching to 'none' algorithm.

**Suggestion:**
​```python
payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
​```

Reference: https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/
```

### 2. Error Handling (Suggestion)

```
🟡 **suggestion (error-handling):** Consider catching specific JWT exceptions.

​```python
try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
except jwt.ExpiredSignatureError:
    raise AuthError('Token expired', code=401)
except jwt.InvalidTokenError:
    raise AuthError('Invalid token', code=401)
​```

This gives users actionable error messages.
```

### 3. Praise

```
🟢 **praise:** Clean separation of auth logic into middleware. This will make testing much easier!
```

### 4. Nitpick (Non-blocking)

```
⚪ **nitpick (style):** Consider using `get()` with default for cleaner None check:

​```python
token = request.headers.get('Authorization', '')
if not token:
​```
```

## Summary Comment

```markdown
## Review Summary

Thanks for adding auth! The implementation is clean and well-structured.

### Must Fix (Blocking)
- [ ] Add `algorithms` parameter to `jwt.decode()` (security)

### Should Consider
- [ ] Specific JWT exception handling for better UX

### Nice to Have
- [ ] Minor style improvements

LGTM once the security issue is addressed! 🔐
```

## Key Takeaways

1. **Lead with praise** - Acknowledge good work first
2. **Use conventional comments** - Clear severity (issue/suggestion/nitpick)
3. **Provide context** - Explain *why*, not just *what*
4. **Include examples** - Show the fix, don't just describe it
5. **Summarize** - Group by priority for easy action
