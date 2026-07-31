# OrchestKit Docs — Environment Template (1Password)
# Usage: op run --env-file=.env.tpl -- <command>
# All secrets resolved at runtime from 1Password. Safe to commit to git.

# ── Analytics (#222) ────────────────────────────────────────────
ANALYTICS_HMAC_SECRET=op://<vault>/<item>/ANALYTICS_HMAC_SECRET

# ── HQ API ──────────────────────────────────────────────────────
HQ_API_URL=https://api.example.com

# ── PostHog (EU cloud, project "OrchestKit") ────────────────────
# Mirror sink only; first-party /api/analytics stays authoritative.
# Public phc_ key, but kept here so prod and local resolve the same way.
NEXT_PUBLIC_POSTHOG_KEY=op://<vault>/<item>/NEXT_PUBLIC_POSTHOG_KEY
