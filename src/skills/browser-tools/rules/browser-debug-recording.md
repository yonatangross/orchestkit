---
title: Use browser debug and recording tools safely to avoid leaking sensitive data in traces
category: browser
impact: HIGH
impactDescription: "Traces, profiles, and recordings can capture auth tokens, credentials, and PII in their output files"
tags: [debug, recording, tracing, profiling, security]
---

## Browser: Debug & Recording

Use trace, profiler, and record commands for debugging and bug reports, but always review output files before sharing — they may contain sensitive data (cookies, tokens, form inputs).

**Incorrect:**
```bash
# Recording a login flow — captures credentials in video/trace
agent-browser trace start /tmp/trace.zip
agent-browser open https://app.example.com/login
agent-browser fill @e1 "$EMAIL"
agent-browser fill @e2 "$PASSWORD"
agent-browser click @e3
agent-browser trace stop
# /tmp/trace.zip now contains your credentials in cleartext

# Dumping console output without filtering
agent-browser console > /tmp/console.log
# May contain auth tokens, API keys logged by the app

# Sharing errors log without review
agent-browser errors > /tmp/errors.log
git add /tmp/errors.log  # Could contain PII in stack traces
```

**Correct:**
```bash
# Record AFTER authentication (load saved state first)
agent-browser vault load my-session
agent-browser trace start /tmp/trace.zip
agent-browser open https://app.example.com/dashboard
# ... perform actions to reproduce bug ...
agent-browser trace stop
# Trace captures only post-auth interactions

# Review console output before saving
agent-browser console  # Review in terminal first
# Only redirect to file after confirming no sensitive data

# Profiler for performance debugging (safe — no credentials)
agent-browser profiler start
agent-browser open https://app.example.com/slow-page
agent-browser wait --load networkidle
agent-browser profiler stop /tmp/profile.json
# Profile contains JS execution data, not credentials

# Record for visual bug reports (after auth)
agent-browser record start /tmp/bug-repro.webm
agent-browser click @e5
agent-browser wait --text "Error"
agent-browser record stop
```

**Key rules:**
- Never trace or record login flows — credentials appear in cleartext in output files
- Load auth state via `vault load` before starting a trace/recording session
- Review `console` and `errors` output in terminal before redirecting to files
- Never commit trace, recording, or profile files to git repositories
- Use `profiler` for performance analysis — it captures execution timing, not credentials
- Store debug output files in `/tmp/` or ephemeral directories, not project directories
- Scrub trace files before sharing: remove cookies, localStorage, and network payloads

Reference: `references/debug-tools.md` (Trace Safety, Recording Best Practices)
