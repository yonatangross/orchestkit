# OAuth 2.1 & Passkeys Reference

## OAuth 2.1 Overview

OAuth 2.1 consolidates OAuth 2.0 best practices and security requirements:

### Key Changes from OAuth 2.0

- **PKCE required** for ALL clients (not just public)
- **Implicit grant removed** (security vulnerability)
- **Password grant removed** (credential anti-pattern)
- **Bearer tokens** must use TLS
- **Refresh token rotation** mandatory

### PKCE Flow (Required)

```python
import hashlib
import base64
import secrets

def generate_pkce_pair():
    """Generate code_verifier and code_challenge for PKCE."""
    # Generate random code_verifier (43-128 chars)
    code_verifier = secrets.token_urlsafe(64)
    
    # Create code_challenge using S256
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    
    return code_verifier, code_challenge

# Usage
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
        "code_verifier": verifier,  # PKCE verification
    }
)
```

### Token Lifetimes (2026 Recommendations)

| Token Type | Lifetime | Storage |
|------------|----------|---------|
| Access Token | 15 min - 1 hour | Memory only |
| Refresh Token | 7-30 days | HTTPOnly cookie / secure storage |
| ID Token | Same as access | Memory only |

## DPoP (Demonstrating Proof of Possession)

Binds tokens to client cryptographic keys:

```python
import jwt
import time
import uuid

def create_dpop_proof(http_method: str, http_uri: str, private_key) -> str:
    """Create DPoP proof for request."""
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

# Usage
dpop_proof = create_dpop_proof("POST", "https://api.example.com/token", private_key)

response = requests.post(
    "https://api.example.com/token",
    headers={"DPoP": dpop_proof},
    data={"grant_type": "refresh_token", "refresh_token": rt},
)
```

## Passkeys / WebAuthn

### Overview

Passkeys replace passwords with cryptographic credentials:

- **Phishing-resistant**: Bound to origin
- **Passwordless**: No secrets to remember
- **Multi-device**: Synced via platform
- **Biometric**: Face ID, Touch ID, fingerprint

### Registration Flow

```python
from webauthn import (
    generate_registration_options,
    verify_registration_response,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

# Step 1: Generate registration options
options = generate_registration_options(
    rp_id="example.com",
    rp_name="Example App",
    user_id=user.id.encode(),
    user_name=user.email,
    user_display_name=user.name,
    authenticator_selection=AuthenticatorSelectionCriteria(
        resident_key=ResidentKeyRequirement.REQUIRED,
        user_verification=UserVerificationRequirement.REQUIRED,
    ),
)

# Send options to client
return jsonify(options)

# Step 2: Verify registration response
verification = verify_registration_response(
    credential=client_response,
    expected_challenge=stored_challenge,
    expected_rp_id="example.com",
    expected_origin="https://example.com",
)

# Store credential
db.save_credential(
    user_id=user.id,
    credential_id=verification.credential_id,
    public_key=verification.credential_public_key,
    sign_count=verification.sign_count,
)
```

### Authentication Flow

```python
from webauthn import (
    generate_authentication_options,
    verify_authentication_response,
)

# Step 1: Generate authentication options
options = generate_authentication_options(
    rp_id="example.com",
    allow_credentials=[
        {"id": cred.credential_id, "type": "public-key"}
        for cred in user.credentials
    ],
)

# Step 2: Verify authentication response
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
db.save(stored_credential)

# Issue session/tokens
return create_session(user)
```

### Frontend Implementation

```typescript
// Registration
async function registerPasskey(options: PublicKeyCredentialCreationOptions) {
  const credential = await navigator.credentials.create({
    publicKey: options,
  });
  
  // Send credential to server
  await fetch('/api/auth/passkey/register', {
    method: 'POST',
    body: JSON.stringify(credential),
  });
}

// Authentication
async function authenticateWithPasskey(options: PublicKeyCredentialRequestOptions) {
  const credential = await navigator.credentials.get({
    publicKey: options,
  });
  
  // Send credential to server
  const response = await fetch('/api/auth/passkey/authenticate', {
    method: 'POST',
    body: JSON.stringify(credential),
  });
  
  return response.json();
}

// Conditional UI (autofill)
if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
  const available = await PublicKeyCredential.isConditionalMediationAvailable();
  if (available) {
    // Show passkey autofill in username field
    const credential = await navigator.credentials.get({
      publicKey: options,
      mediation: 'conditional',
    });
  }
}
```

## Refresh Token Rotation

```python
import secrets
import hashlib
from datetime import datetime, timedelta, timezone

def rotate_refresh_token(old_token: str, db) -> tuple[str, str]:
    """Rotate refresh token on use (security best practice)."""
    old_hash = hashlib.sha256(old_token.encode()).hexdigest()
    
    # Find and validate old token
    token_record = db.query("""
        SELECT user_id, version FROM refresh_tokens
        WHERE token_hash = ? AND expires_at > NOW() AND revoked = FALSE
    """, [old_hash]).fetchone()
    
    if not token_record:
        raise InvalidTokenError("Refresh token invalid or expired")
    
    user_id, version = token_record
    
    # Revoke old token
    db.execute(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = ?",
        [old_hash]
    )
    
    # Create new tokens
    new_access_token = create_access_token(user_id)
    
    new_refresh_token = secrets.token_urlsafe(32)
    new_hash = hashlib.sha256(new_refresh_token.encode()).hexdigest()
    
    db.execute("""
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at, version)
        VALUES (?, ?, ?, ?)
    """, [user_id, new_hash, datetime.now(timezone.utc) + timedelta(days=7), version + 1])
    
    return new_access_token, new_refresh_token
```

## External Links

- [OAuth 2.1 Draft Spec](https://oauth.net/2.1/)
- [WebAuthn Spec](https://www.w3.org/TR/webauthn-3/)
- [FIDO Alliance](https://fidoalliance.org/passkeys/)
- [py_webauthn Library](https://github.com/duo-labs/py_webauthn)
