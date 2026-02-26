# Authentication Security Checklist

## Password Security

- [ ] Use Argon2id (preferred) or bcrypt for hashing
- [ ] Minimum 12 character password requirement
- [ ] Check against common password lists
- [ ] No password hints or security questions
- [ ] Rate limit password attempts (5 per minute)
- [ ] Account lockout after 10 failed attempts

## Token Security

- [ ] Access tokens: 15 min - 1 hour lifetime
- [ ] Refresh tokens: 7-30 days with rotation
- [ ] Store access tokens in memory only (not localStorage)
- [ ] Store refresh tokens in HTTPOnly cookies
- [ ] Implement refresh token rotation
- [ ] Revoke all tokens on password change

## Session Security

- [ ] `SESSION_COOKIE_SECURE=True` (HTTPS only)
- [ ] `SESSION_COOKIE_HTTPONLY=True` (no JS access)
- [ ] `SESSION_COOKIE_SAMESITE='Strict'`
- [ ] Session timeout (1 hour inactivity)
- [ ] Regenerate session ID on login

## OAuth 2.1 Compliance

- [ ] Use PKCE for ALL clients
- [ ] No implicit grant
- [ ] No password grant
- [ ] State parameter for CSRF protection
- [ ] Validate redirect_uri exactly
- [ ] Use HTTPS for all endpoints

## Passkeys/WebAuthn (If Implemented)

- [ ] Require user verification (biometric)
- [ ] Require resident keys for passwordless
- [ ] Validate RP ID matches origin
- [ ] Track sign count for replay protection
- [ ] Allow multiple passkeys per user

## Multi-Factor Authentication

- [ ] Offer MFA (TOTP, Passkeys)
- [ ] TOTP: 6 digits, 30-second window
- [ ] Backup codes (10 one-time use)
- [ ] Remember device option (30 days max)
- [ ] Require MFA for sensitive operations

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| Login | 5 per minute |
| Password reset | 3 per hour |
| MFA verify | 5 per minute |
| Registration | 10 per hour |
| API general | 100 per minute |

## Error Messages

- [ ] Generic "Invalid credentials" (don't reveal which is wrong)
- [ ] Don't reveal if email exists in forgot password
- [ ] Log detailed errors server-side only
- [ ] No stack traces in production

## Secure Headers

```python
response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
response.headers['X-Content-Type-Options'] = 'nosniff'
response.headers['X-Frame-Options'] = 'DENY'
response.headers['Content-Security-Policy'] = "default-src 'self'"
```

## Audit Logging

- [ ] Log all authentication attempts
- [ ] Log password changes
- [ ] Log MFA setup/disable
- [ ] Log token revocations
- [ ] Log suspicious activity (multiple failed attempts)

## Review Checklist

Before deployment:

- [ ] No hardcoded secrets in code
- [ ] Secrets in environment variables
- [ ] HTTPS enforced everywhere
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Password hashing uses Argon2id or bcrypt
- [ ] Token lifetimes appropriate
- [ ] MFA available

## Common Vulnerabilities to Avoid

- [ ] No password in URL parameters
- [ ] No session ID in URL
- [ ] No sensitive data in JWT payload
- [ ] No implicit OAuth grant
- [ ] No predictable session IDs
- [ ] No client-side token storage in localStorage
