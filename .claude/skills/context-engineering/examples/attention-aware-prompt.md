# Example: Attention-Aware Agent Prompt

This example demonstrates how to structure an agent prompt with attention positioning in mind.

---

## Before: Unoptimized Prompt

```markdown
Here are some documents that might be helpful:

Document 1: Authentication Guide
OAuth 2.0 implementation details...
[2000 tokens of documentation]

Document 2: API Reference
REST endpoints for user management...
[1500 tokens of documentation]

Document 3: Security Best Practices
Input validation and sanitization...
[1000 tokens of documentation]

Previous conversation:
User: How do I set up auth?
Assistant: You'll need to configure OAuth...
User: What about refresh tokens?
Assistant: Refresh tokens should be...
[500 tokens of history]

You are a helpful assistant. Help the user with their coding questions.

User: How should I store the access token securely?
```

### Problems:
- Identity buried at the end (low attention)
- All documents loaded regardless of relevance
- No constraints or boundaries defined
- Critical security context in middle

---

## After: Attention-Optimized Prompt

```markdown
[=== START: HIGH ATTENTION ZONE ===]

## Agent Identity
You are a senior security engineer specializing in authentication systems.
You have 15+ years of experience with OAuth 2.0, JWT, and secure token storage.

## Critical Security Rules (NEVER VIOLATE)
- NEVER suggest storing tokens in localStorage (XSS vulnerable)
- NEVER recommend disabling HTTPS for any reason
- NEVER suggest hardcoding secrets in client-side code
- ALWAYS recommend httpOnly cookies for token storage in browsers

## Response Principles
- Explain security implications of each approach
- Provide code examples with security best practices
- Mention common vulnerabilities to avoid
- Suggest security testing approaches

[=== MIDDLE: BACKGROUND CONTEXT ===]

## Relevant Documentation
### Token Storage Best Practices
[RELEVANCE: HIGH - directly addresses user question]

Browser environments:
- Use httpOnly, Secure, SameSite cookies
- Implement CSRF protection
- Consider token rotation strategies

Native apps:
- Use platform secure storage (Keychain, Keystore)
- Encrypt tokens at rest
- Implement biometric unlock where appropriate

### Previous Conversation Summary
User is implementing OAuth 2.0 authentication for a web application.
Has configured the authorization flow and is now addressing token storage.
Key decision: Using access + refresh token pattern.

[=== END: HIGH ATTENTION ZONE ===]

## Current Question
The user asks: "How should I store the access token securely?"

## Response Format
1. Recommend the best approach for their use case (web app)
2. Explain WHY this approach is secure
3. Provide a code example
4. Mention what to avoid and why
5. Suggest a testing approach to verify security
```

---

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Identity position | END (buried) | START (high attention) |
| Security rules | None | START (non-negotiable) |
| Document relevance | All loaded | Filtered, relevance-tagged |
| History handling | Raw conversation | Summarized key points |
| Current task | Buried | END (high attention) |
| Output format | Undefined | END (guides generation) |

---

## Token Comparison

| Component | Before | After | Savings |
|-----------|--------|-------|---------|
| Documents | 4,500 | 800 | 82% |
| History | 500 | 100 | 80% |
| System | 50 | 300 | -500% (investment) |
| Current | 50 | 150 | -200% (investment) |
| **Total** | **5,100** | **1,350** | **73%** |

The increased investment in system prompt and current task structure is offset by massive savings in document and history compression.

---

## Applying This Pattern

### Step 1: Define High-Attention Zones

```markdown
[=== START: HIGH ATTENTION ===]
- Agent identity (role, expertise)
- Non-negotiable constraints
- Core principles

[=== MIDDLE: LOWER ATTENTION ===]
- Retrieved documents (filtered, tagged)
- Conversation summary (compressed)
- Background context

[=== END: HIGH ATTENTION ===]
- Current task/query
- Recent context
- Output format requirements
```

### Step 2: Tag Document Relevance

```markdown
## Document: Authentication Patterns
[RELEVANCE: HIGH for auth questions, LOW for database questions]
```

### Step 3: Summarize, Don't Dump

```markdown
## Previous Conversation Summary
Key facts:
- Building web app with React frontend
- Using OAuth 2.0 with Google provider
- Decided on access + refresh token pattern
- Current phase: Token storage implementation
```

### Step 4: Structure Output Expectations

```markdown
## Response Format
1. Direct answer to the question
2. Security rationale
3. Code example
4. What to avoid
5. Testing suggestion
```

---

## Template for Your Agents

```markdown
[=== START ===]
## Identity
You are a {role} with expertise in {domains}.

## Critical Rules
- NEVER {dangerous_action_1}
- NEVER {dangerous_action_2}
- ALWAYS {required_behavior}

## Principles
- {principle_1}
- {principle_2}
- {principle_3}

[=== MIDDLE ===]
## Relevant Context
{filtered_documents_with_relevance_tags}

## Conversation Summary
{compressed_history}

[=== END ===]
## Current Task
{user_query}

## Response Format
{structured_output_requirements}
```
