---
title: Write technical documentation in active voice with scannable structure
impact: MEDIUM
impactDescription: "Passive, verbose documentation is skipped by readers, causing misuse and support burden"
tags: [writing-style, technical-writing, active-voice, readability]
---

## Technical Writing Style

Documentation is read under time pressure. Every sentence must earn its place.

**Incorrect -- passive, verbose, unfocused:**
```markdown
## Authentication

It should be noted that authentication is performed by the system
through the utilization of JWT tokens which are issued when a login
request has been successfully processed by the authentication service.
The token that is returned should be included in subsequent requests
that are made to protected endpoints. It is important to remember
that tokens have an expiration time that is set to 24 hours after
which a new token will need to be obtained by the client application
through the refresh token flow which has been implemented as described
in the following section of this document.
```

**Correct -- active, scannable, direct:**
```markdown
## Authentication

The API uses JWT Bearer tokens. Include the token in the
`Authorization` header of every request to a protected endpoint.

**Token lifecycle:**
1. Call `POST /auth/login` with credentials to get an access token
2. Include `Authorization: Bearer <token>` in subsequent requests
3. Tokens expire after 24 hours
4. Call `POST /auth/refresh` with the refresh token before expiry

**Example:**
  curl -H "Authorization: Bearer eyJhbG..." https://api.example.com/users
```

**Key rules:**

### Voice and tense
- Use active voice: "The function returns" not "A value is returned by"
- Use present tense: "This endpoint creates" not "This endpoint will create"
- Use second person for instructions: "You configure" not "The user configures"
- Use imperative mood for steps: "Run the command" not "You should run the command"

### Sentence structure
- One idea per sentence -- split compound sentences at conjunctions
- Lead with the action or outcome, not the condition
- Maximum 25 words per sentence for instructional content
- Cut filler words: "It should be noted that" becomes nothing; "in order to" becomes "to"

### Scannable structure
- Use headings every 3-5 paragraphs to break up walls of text
- Use numbered lists for sequential steps, bulleted lists for unordered items
- Use tables for comparing options or listing parameters
- Use bold for key terms on first use and for warnings
- Use code formatting for commands, file paths, variables, and values

### Content principles
- Prefer code examples over prose explanations
- State what something does before explaining how it works
- Document the 80% use case first, then edge cases
- Link to source code or specs rather than duplicating them
- When docs and code disagree, code is the source of truth -- update the docs

### API documentation checklist
- [ ] Every endpoint has a one-line summary and a description
- [ ] All parameters documented with type, required/optional, and default
- [ ] Request and response bodies have schemas with examples
- [ ] Error responses listed with status codes and meanings
- [ ] Authentication requirements stated per-endpoint or globally
- [ ] Rate limits and pagination documented
