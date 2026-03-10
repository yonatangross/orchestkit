# OrchestKit Docs — Environment Template (1Password)
# Usage: op run --env-file=.env.tpl -- <command>
# All secrets resolved at runtime from 1Password. Safe to commit to git.

# ── Analytics (#222) ────────────────────────────────────────────
ANALYTICS_HMAC_SECRET=op://Private/your-project/Dev Auth/ANALYTICS_HMAC_SECRET

# ── HQ API ──────────────────────────────────────────────────────
HQ_API_URL=https://api.example.com
