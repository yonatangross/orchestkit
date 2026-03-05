---
title: Structure READMEs with all essential sections for discoverability and onboarding
impact: HIGH
impactDescription: "Incomplete READMEs cause slow onboarding, repeated questions, and abandoned evaluations"
tags: [readme, onboarding, project-setup, open-source]
---

## README Structure

A README is the front door to any project. It must answer: what is this, how do I use it, and how do I contribute -- in that order.

**Incorrect -- bare README with no structure:**
```markdown
# my-app

This is my app. It does stuff.

Run `npm start` to start it.
```

**Correct -- full structured README:**
```markdown
# Project Name

Brief description of what the project does and why it exists (1-2 sentences).

## Quick Start

Minimal steps to get running (copy-paste ready):

  git clone https://github.com/org/project.git
  cd project
  npm install
  npm start

## Installation

### Prerequisites
- Node.js >= 20
- PostgreSQL 16+

### Steps
1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `npm install`
4. Run `npm run db:migrate`

## Usage

Common use cases with runnable code examples:

  import { createClient } from 'project';
  const client = createClient({ apiKey: process.env.API_KEY });
  const result = await client.process(data);

## API Reference

Link to generated docs or inline the key endpoints/functions.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `LOG_LEVEL` | Logging verbosity | `info` |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'feat: add feature'`)
4. Push to branch (`git push origin feat/my-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## License

MIT -- see [LICENSE](LICENSE) for details.
```

**Key rules:**
- Lead with a one-line description -- readers decide in 5 seconds whether to continue
- Quick Start must be copy-paste ready with no ambiguity
- Include a configuration table for all environment variables
- Link to CONTRIBUTING.md for detailed contributor guidance
- Every code example must be runnable without modification (except secrets)

**Section order matters:** Name > Description > Quick Start > Install > Usage > API > Config > Contributing > License. Users scan top-down and drop off -- put the most useful content first.
