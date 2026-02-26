---
title: Implement OAuth 2.1 with mandatory PKCE, token rotation, and phishing-resistant passkeys
category: auth
impact: CRITICAL
impactDescription: "Prevents authorization vulnerabilities through mandatory PKCE, token rotation, and phishing-resistant passkeys"
tags: oauth, pkce, passkeys, webauthn, dpop
---

# OAuth 2.1 & Passkeys/WebAuthn

## OAuth 2.1 Key Changes

- **PKCE required** for ALL clients (not just public)
- **Implicit grant removed** (security vulnerability)
- **Password grant removed** (credential anti-pattern)
- **Refresh token rotation** mandatory

## PKCE Flow (Required)

```python
import hashlib, base64, secrets

def generate_pkce_pair():
    code_verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return code_verifier, code_challenge

verifier, challenge = generate_pkce_pair()

# Step 1: Authorization request
auth_url = f"""https://auth.example.com/authorize?
    response_type=code
    &client_id={client_id}
    &redirect_uri={redirect_uri}
    &code_challenge={challenge}
    &code_challenge_method=S256
    &state={state}
    &scope=openid profile"""

# Step 2: Exchange code for tokens
token_response = requests.post(
    "https://auth.example.com/token",
    data={
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "code_verifier": verifier,
    }
)
```

## DPoP (Demonstrating Proof of Possession)

```python
import jwt, time, uuid

def create_dpop_proof(http_method: str, http_uri: str, private_key) -> str:
    claims = {
        "jti": str(uuid.uuid4()),
        "htm": http_method,
        "htu": http_uri,
        "iat": int(time.time()),
    }
    headers = {
        "typ": "dpop+jwt",
        "alg": "ES256",
        "jwk": private_key.public_key().export_key(),
    }
    return jwt.encode(claims, private_key, algorithm="ES256", headers=headers)
```

## Passkeys/WebAuthn Registration

```python
from webauthn import generate_registration_options, verify_registration_response
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

options = generate_registration_options(
    rp_id="example.com",
    rp_name="Example App",
    user_id=user.id.encode(),
    user_name=user.email,
    authenticator_selection=AuthenticatorSelectionCriteria(
        resident_key=ResidentKeyRequirement.REQUIRED,
        user_verification=UserVerificationRequirement.REQUIRED,
    ),
)
```

## Passkeys Authentication

```python
from webauthn import generate_authentication_options, verify_authentication_response

options = generate_authentication_options(
    rp_id="example.com",
    allow_credentials=[
        {"id": cred.credential_id, "type": "public-key"}
        for cred in user.credentials
    ],
)

verification = verify_authentication_response(
    credential=client_response,
    expected_challenge=stored_challenge,
    expected_rp_id="example.com",
    expected_origin="https://example.com",
    credential_public_key=stored_credential.public_key,
    credential_current_sign_count=stored_credential.sign_count,
)

# Update sign count (replay protection)
stored_credential.sign_count = verification.new_sign_count
```

## Frontend Passkey Implementation

```typescript
// Registration
async function registerPasskey(options: PublicKeyCredentialCreationOptions) {
  const credential = await navigator.credentials.create({ publicKey: options });
  await fetch('/api/auth/passkey/register', {
    method: 'POST', body: JSON.stringify(credential),
  });
}

// Conditional UI (autofill)
if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
  const available = await PublicKeyCredential.isConditionalMediationAvailable();
  if (available) {
    const credential = await navigator.credentials.get({
      publicKey: options, mediation: 'conditional',
    });
  }
}
```

## Anti-Patterns

```python
# NEVER use implicit OAuth grant
response_type=token  # Deprecated in OAuth 2.1

# NEVER skip PKCE
# PKCE is required for ALL clients in OAuth 2.1

# ALWAYS use PKCE with S256
code_challenge=challenge&code_challenge_method=S256
```

**Incorrect — OAuth 2.0 token exchange without PKCE is vulnerable to interception:**
```python
# No PKCE verification
token_response = requests.post(
    "https://auth.example.com/token",
    data={
        "grant_type": "authorization_code",
        "code": auth_code,
        "client_id": client_id,
    }
)
```

**Correct — OAuth 2.1 requires PKCE for all clients to prevent code interception:**
```python
# Generate and verify PKCE challenge
verifier, challenge = generate_pkce_pair()
token_response = requests.post(
    "https://auth.example.com/token",
    data={
        "grant_type": "authorization_code",
        "code": auth_code,
        "client_id": client_id,
        "code_verifier": verifier,  # Proves client possession
    }
)
```
