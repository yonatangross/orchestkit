---
name: vercel-emulate-google
description: "Google API emulation: OAuth, Gmail, Calendar, Drive."
tags:
  - emulate
  - google
  - oauth
  - api

version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: low
upstream:
  repo: vercel-labs/emulate
  path: skills/google/SKILL.md
  synced: "2026-03-31T11:04:37Z"
  status: synced
---


# Google OAuth 2.0 / OIDC Emulator

OAuth 2.0 and OpenID Connect emulation with authorization code flow, PKCE support, ID tokens, and OIDC discovery.

## Start

```bash
# Google only
npx emulate --service google

# Default port
# http://localhost:4002
```

Or programmatically:

```typescript
import { createEmulator } from 'emulate'

const google = await createEmulator({ service: 'google', port: 4002 })
// google.url === 'http://localhost:4002'
```

## Pointing Your App at the Emulator

### Environment Variable

```bash
GOOGLE_EMULATOR_URL=http://localhost:4002
```

### OAuth URL Mapping

| Real Google URL | Emulator URL |
|-----------------|-------------|
| `https://accounts.google.com/o/oauth2/v2/auth` | `$GOOGLE_EMULATOR_URL/o/oauth2/v2/auth` |
| `https://oauth2.googleapis.com/token` | `$GOOGLE_EMULATOR_URL/oauth2/token` |
| `https://www.googleapis.com/oauth2/v2/userinfo` | `$GOOGLE_EMULATOR_URL/oauth2/v2/userinfo` |
| `https://accounts.google.com/.well-known/openid-configuration` | `$GOOGLE_EMULATOR_URL/.well-known/openid-configuration` |
| `https://www.googleapis.com/oauth2/v3/certs` | `$GOOGLE_EMULATOR_URL/oauth2/v3/certs` |

### google-auth-library (Node.js)

```typescript
import { OAuth2Client } from 'google-auth-library'

const GOOGLE_URL = process.env.GOOGLE_EMULATOR_URL ?? 'https://accounts.google.com'

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/api/auth/callback/google',
})

// Override the endpoints
const authorizeUrl = client.generateAuthUrl({
  access_type: 'offline',
  scope: ['openid', 'email', 'profile'],
})
// Replace the host in authorizeUrl with GOOGLE_URL, or construct manually:
const emulatorAuthorizeUrl = `${GOOGLE_URL}/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=...&scope=openid+email+profile&response_type=code&state=...`
```

### Auth.js / NextAuth.js

```typescript
import Google from '@auth/core/providers/google'

Google({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    url: `${process.env.GOOGLE_EMULATOR_URL}/o/oauth2/v2/auth`,
    params: { scope: 'openid email profile' },
  },
  token: {
    url: `${process.env.GOOGLE_EMULATOR_URL}/oauth2/token`,
  },
  userinfo: {
    url: `${process.env.GOOGLE_EMULATOR_URL}/oauth2/v2/userinfo`,
  },
})
```

### Passport.js

```typescript
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'

const GOOGLE_URL = process.env.GOOGLE_EMULATOR_URL ?? 'https://accounts.google.com'

new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/api/auth/callback/google',
  authorizationURL: `${GOOGLE_URL}/o/oauth2/v2/auth`,
  tokenURL: `${GOOGLE_URL}/oauth2/token`,
  userProfileURL: `${GOOGLE_URL}/oauth2/v2/userinfo`,
}, verifyCallback)
```

## Seed Config

```yaml
google:
  users:
    - email: testuser@gmail.com
      name: Test User
      given_name: Test
      family_name: User
      picture: https://lh3.googleusercontent.com/a/default-user
      email_verified: true
      locale: en
    - email: dev@example.com
      name: Developer
  oauth_clients:
    - client_id: my-client-id.apps.googleusercontent.com
      client_secret: GOCSPX-secret
      name: My App
      redirect_uris:
        - http://localhost:3000/api/auth/callback/google
```

When no OAuth clients are configured, the emulator accepts any `client_id`. With clients configured, strict validation is enforced for `client_id`, `client_secret`, and `redirect_uri`.

## API Endpoints

### OIDC Discovery

```bash
curl http://localhost:4002/.well-known/openid-configuration
```

Returns the standard OIDC discovery document with all endpoints pointing to the emulator:

```json
{
  "issuer": "http://localhost:4002",
  "authorization_endpoint": "http://localhost:4002/o/oauth2/v2/auth",
  "token_endpoint": "http://localhost:4002/oauth2/token",
  "userinfo_endpoint": "http://localhost:4002/oauth2/v2/userinfo",
  "revocation_endpoint": "http://localhost:4002/oauth2/revoke",
  "jwks_uri": "http://localhost:4002/oauth2/v3/certs",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["HS256"],
  "scopes_supported": ["openid", "email", "profile"],
  "code_challenge_methods_supported": ["plain", "S256"]
}
```

### JWKS

```bash
curl http://localhost:4002/oauth2/v3/certs
```

Returns `{ "keys": [] }`. ID tokens are signed with HS256 using an internal secret.

### Authorization

```bash
# Browser flow -- redirects to a user picker page
curl -v "http://localhost:4002/o/oauth2/v2/auth?\
client_id=my-client-id.apps.googleusercontent.com&\
redirect_uri=http://localhost:3000/api/auth/callback/google&\
scope=openid+email+profile&\
response_type=code&\
state=random-state&\
nonce=random-nonce"
```

Query parameters:

| Param | Description |
|-------|-------------|
| `client_id` | OAuth client ID |
| `redirect_uri` | Callback URL |
| `scope` | Space-separated scopes (`openid email profile`) |
| `state` | Opaque state for CSRF protection |
| `nonce` | Nonce for ID token (optional) |
| `code_challenge` | PKCE challenge (optional) |
| `code_challenge_method` | `plain` or `S256` (optional) |

The emulator renders an HTML page where you select a seeded user. After selection, it redirects to `redirect_uri` with `?code=...&state=...`.

### Token Exchange

```bash
curl -X POST http://localhost:4002/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=<authorization_code>&\
client_id=my-client-id.apps.googleusercontent.com&\
client_secret=GOCSPX-secret&\
redirect_uri=http://localhost:3000/api/auth/callback/google&\
grant_type=authorization_code"
```

Returns:

```json
{
  "access_token": "google_...",
  "id_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid email profile"
}
```

The `id_token` is a JWT (HS256) containing `sub`, `email`, `email_verified`, `name`, `given_name`, `family_name`, `picture`, `locale`, and optional `nonce`.

For PKCE, include `code_verifier` in the token request.

### User Info

```bash
curl http://localhost:4002/oauth2/v2/userinfo \
  -H "Authorization: Bearer google_..."
```

Returns:

```json
{
  "sub": "user-uid",
  "email": "testuser@gmail.com",
  "email_verified": true,
  "name": "Test User",
  "given_name": "Test",
  "family_name": "User",
  "picture": "https://lh3.googleusercontent.com/a/default-user",
  "locale": "en"
}
```

### Token Revocation

```bash
curl -X POST http://localhost:4002/oauth2/revoke \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "token=google_..."
```

Returns `200 OK`. The token is removed from the emulator's token map.

## Common Patterns

### Full Authorization Code Flow

```bash
GOOGLE_URL="http://localhost:4002"
CLIENT_ID="my-client-id.apps.googleusercontent.com"
CLIENT_SECRET="GOCSPX-secret"
REDIRECT_URI="http://localhost:3000/api/auth/callback/google"

# 1. Open in browser -- user picks a seeded account
#    $GOOGLE_URL/o/oauth2/v2/auth?client_id=$CLIENT_ID&redirect_uri=$REDIRECT_URI&scope=openid+email+profile&response_type=code&state=abc

# 2. After user selection, emulator redirects to:
#    $REDIRECT_URI?code=<code>&state=abc

# 3. Exchange code for tokens
curl -X POST $GOOGLE_URL/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=<code>&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&redirect_uri=$REDIRECT_URI&grant_type=authorization_code"

# 4. Fetch user info with the access_token
curl $GOOGLE_URL/oauth2/v2/userinfo \
  -H "Authorization: Bearer <access_token>"
```

### PKCE Flow

```bash
# Generate code_verifier and code_challenge
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-43)
CODE_CHALLENGE=$(echo -n $CODE_VERIFIER | openssl dgst -sha256 -binary | base64 | tr -d '=' | tr '+/' '-_')

# 1. Authorize with challenge
# $GOOGLE_URL/o/oauth2/v2/auth?...&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256

# 2. Token exchange with verifier
curl -X POST $GOOGLE_URL/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "code=<code>&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&redirect_uri=$REDIRECT_URI&grant_type=authorization_code&code_verifier=$CODE_VERIFIER"
```

### OIDC Discovery-Based Setup

Libraries that support OIDC discovery (like `openid-client`) can auto-configure from the discovery document:

```typescript
import { Issuer } from 'openid-client'

const googleIssuer = await Issuer.discover(
  process.env.GOOGLE_EMULATOR_URL ?? 'https://accounts.google.com'
)

const client = new googleIssuer.Client({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: ['http://localhost:3000/api/auth/callback/google'],
})
```
