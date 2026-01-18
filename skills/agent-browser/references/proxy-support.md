# Proxy Support (v0.6.0)

Route browser traffic through HTTP, HTTPS, or SOCKS proxies.

## Basic Proxy Usage

```bash
# HTTP proxy
agent-browser open https://example.com --proxy http://proxy.company.com:8080

# HTTPS proxy
agent-browser open https://example.com --proxy https://proxy.company.com:8443

# SOCKS5 proxy
agent-browser open https://example.com --proxy socks5://proxy.company.com:1080
```

## Proxy Authentication

```bash
# Include credentials in URL
agent-browser open https://example.com --proxy http://user:password@proxy.company.com:8080

# URL-encoded special characters
agent-browser open https://example.com --proxy http://user:p%40ssword@proxy.company.com:8080
```

## Session-Wide Proxy

Set proxy for an entire session:

```bash
# All commands in this session use the proxy
agent-browser --session proxied --proxy http://proxy:8080 open https://example.com
agent-browser --session proxied snapshot -i
agent-browser --session proxied click @e1
```

## Common Patterns

### Corporate Proxy

```bash
#!/bin/bash
# Use corporate proxy for internal sites

CORP_PROXY="http://proxy.corp.example.com:8080"

agent-browser --proxy "$CORP_PROXY" open https://internal.corp.example.com
agent-browser snapshot -i
agent-browser get text body
```

### Geo-Location Testing

```bash
#!/bin/bash
# Test from different geographic locations

# US proxy
agent-browser --session us --proxy http://us-proxy.example.com:8080 \
    open https://app.example.com
agent-browser --session us screenshot /tmp/us-view.png

# EU proxy
agent-browser --session eu --proxy http://eu-proxy.example.com:8080 \
    open https://app.example.com
agent-browser --session eu screenshot /tmp/eu-view.png

# Compare pricing/content differences
```

### Residential Proxy Rotation

```bash
#!/bin/bash
# Rotate through residential proxies for scraping

PROXIES=(
    "http://user:pass@residential1.proxy.com:8080"
    "http://user:pass@residential2.proxy.com:8080"
    "http://user:pass@residential3.proxy.com:8080"
)

for i in "${!PROXIES[@]}"; do
    PROXY="${PROXIES[$i]}"
    SESSION="session-$i"

    agent-browser --session "$SESSION" --proxy "$PROXY" \
        open "https://target-site.com/page-$i"

    agent-browser --session "$SESSION" get text body > "/tmp/page-$i.txt"
    agent-browser --session "$SESSION" close
done
```

### Debug with Mitmproxy

```bash
#!/bin/bash
# Route through mitmproxy for traffic inspection

# Start mitmproxy (separate terminal)
# mitmproxy --listen-port 8080

# Route browser through mitmproxy
agent-browser --proxy http://localhost:8080 open https://example.com

# Now inspect traffic in mitmproxy
```

## Proxy Types

| Type | URL Format | Use Case |
|------|------------|----------|
| HTTP | `http://host:port` | General web traffic |
| HTTPS | `https://host:port` | Encrypted proxy connection |
| SOCKS4 | `socks4://host:port` | Legacy proxy support |
| SOCKS5 | `socks5://host:port` | All traffic types, DNS through proxy |

## Environment Variable Alternative

```bash
# Set proxy via environment (not recommended - less explicit)
export HTTP_PROXY="http://proxy:8080"
export HTTPS_PROXY="http://proxy:8080"

agent-browser open https://example.com
```

**Note**: `--proxy` flag takes precedence over environment variables.

## Verify Proxy Is Working

```bash
#!/bin/bash
# Check that traffic goes through proxy

# Visit IP-checking service
agent-browser --proxy "$PROXY" open https://httpbin.org/ip
agent-browser get text body

# Should show proxy IP, not your real IP
```

## Proxy Bypass

No built-in bypass list. For local/internal sites without proxy:

```bash
#!/bin/bash
# Use different sessions for proxy/no-proxy

# Proxied session for external sites
agent-browser --session external --proxy http://proxy:8080 \
    open https://external-site.com

# Direct session for internal sites (no --proxy flag)
agent-browser --session internal \
    open http://internal.local
```

## Troubleshooting

### Connection Refused

```bash
# Check proxy is reachable
curl -x http://proxy:8080 https://example.com

# Verify credentials
curl -x http://user:pass@proxy:8080 https://example.com
```

### SSL Certificate Errors

```bash
# For corporate proxies with custom CA
# (agent-browser trusts system certificates)

# On macOS
security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain corporate-ca.crt

# On Linux
cp corporate-ca.crt /usr/local/share/ca-certificates/
update-ca-certificates
```

### Timeout Issues

```bash
# Increase timeout for slow proxies
agent-browser --proxy http://slow-proxy:8080 \
    --timeout 60000 \
    open https://example.com
```

## Security Considerations

1. **Credential Exposure**: Proxy credentials visible in process list
   ```bash
   # Prefer environment variables for sensitive proxies
   export PROXY_URL="http://user:pass@proxy:8080"
   agent-browser --proxy "$PROXY_URL" open https://example.com
   ```

2. **Proxy Logging**: Proxy server may log all traffic

3. **HTTPS Inspection**: Corporate proxies may terminate TLS (MITM)
