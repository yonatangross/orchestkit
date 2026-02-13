# MCP Server Pre-Deployment Checklist

## Server Setup
- [ ] FastMCP lifespan used for resource management
- [ ] Transport selected (stdio for CLI, SSE for web, Streamable HTTP for production)
- [ ] All tools have descriptive docstrings
- [ ] Input validation on all tool arguments
- [ ] Error responses return text content (not exceptions)

## Security Hardening
- [ ] Zero-trust tool allowlist configured
- [ ] Tool description sanitization enabled
- [ ] Hash verification on tool invocations
- [ ] No secrets in tool output (API keys, credentials)
- [ ] Human-in-the-loop for high-risk operations
- [ ] Encoding normalization applied to inputs
- [ ] Injection pattern detection active

## Resource Management
- [ ] Response sizes bounded (Claude context limits)
- [ ] Resource caching with TTL and LRU eviction
- [ ] Memory cap configured for resource cache
- [ ] No blocking synchronous code in async server

## Testing
- [ ] Tool invocations tested with valid and invalid inputs
- [ ] Security rules validated against injection payloads
- [ ] Transport failover tested (reconnect behavior)
- [ ] Lifecycle cleanup verified (no leaked connections)
