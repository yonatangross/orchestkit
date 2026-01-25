# Cloud Browser Providers (v0.7.0)

Run browser automation on cloud infrastructure for scalability, geo-distribution, and avoiding local resource constraints.

## Supported Providers

| Provider | Flag Value | Use Case |
|----------|------------|----------|
| Browserbase | `browserbase` | Production automation, scaling |
| Browser Use | `browseruse` | AI-native browser automation |

## Basic Usage

```bash
# Use Browserbase
agent-browser -p browserbase open https://example.com

# Use Browser Use
agent-browser -p browseruse open https://example.com

# Or with long flag
agent-browser --provider browserbase open https://example.com
```

## Provider Configuration

### Browserbase

1. **Sign up** at [browserbase.com](https://browserbase.com)
2. **Get API key** from dashboard
3. **Configure environment**:

```bash
# Required
export BROWSERBASE_API_KEY="your-api-key"

# Optional - project ID
export BROWSERBASE_PROJECT_ID="your-project-id"
```

4. **Use provider**:

```bash
agent-browser -p browserbase open https://example.com
agent-browser snapshot -i
agent-browser click @e1
```

### Browser Use

1. **Sign up** at [browseruse.com](https://browseruse.com)
2. **Get API key** from settings
3. **Configure environment**:

```bash
export BROWSER_USE_API_KEY="your-api-key"
```

4. **Use provider**:

```bash
agent-browser -p browseruse open https://example.com
```

## Environment Variable Alternative

Set default provider via environment:

```bash
# In shell profile
export AGENT_BROWSER_PROVIDER="browserbase"

# Now all commands use cloud provider
agent-browser open https://example.com
```

## When to Use Cloud Providers

### Use Cloud When:

- **Scaling**: Running many parallel browser sessions
- **Geo-testing**: Testing from different geographic regions
- **Resource constraints**: Local machine lacks resources
- **CI/CD**: Running in containers without display
- **Long-running tasks**: Avoid local machine timeout/sleep issues
- **Anonymity**: Need fresh IPs for each session

### Use Local When:

- **Development**: Fast iteration, debugging
- **Low volume**: Single browser session
- **Sensitive data**: Data must stay local
- **Offline work**: No internet connectivity

## Provider Features Comparison

| Feature | Local | Browserbase | Browser Use |
|---------|-------|-------------|-------------|
| Cost | Free | Pay-per-use | Pay-per-use |
| Scaling | Limited | High | High |
| Geo-locations | Local only | Multiple | Multiple |
| Session recording | Manual | Built-in | Built-in |
| Stealth mode | Limited | Built-in | Built-in |
| AI features | None | None | Native AI |

## Example: Geo-Testing

```bash
#!/bin/bash
# Test site from multiple regions using cloud provider

export BROWSERBASE_API_KEY="..."

REGIONS=("us-east" "eu-west" "ap-south")

for region in "${REGIONS[@]}"; do
    echo "Testing from $region..."

    # Browserbase supports region selection
    BROWSERBASE_REGION="$region" agent-browser -p browserbase \
        open https://example.com

    agent-browser screenshot "/tmp/screenshot-$region.png"
    agent-browser get text body > "/tmp/content-$region.txt"
    agent-browser close
done
```

## Example: Parallel Scaling

```bash
#!/bin/bash
# Run 10 parallel browser sessions in cloud

export BROWSERBASE_API_KEY="..."

for i in {1..10}; do
    (
        agent-browser -p browserbase --session "worker-$i" \
            open "https://example.com/page-$i"
        agent-browser --session "worker-$i" snapshot -i
        agent-browser --session "worker-$i" get text body > "/tmp/page-$i.txt"
        agent-browser --session "worker-$i" close
    ) &
done

wait
echo "All sessions complete"
```

## Combining with Other Options

```bash
# Cloud provider with profile persistence
agent-browser -p browserbase --profile ~/.agent-browser/cloud-profile \
    open https://example.com

# Cloud provider with proxy
agent-browser -p browserbase --proxy http://proxy:8080 \
    open https://example.com

# Cloud provider with custom user agent
agent-browser -p browserbase --user-agent "Custom Agent/1.0" \
    open https://example.com
```

## Cost Optimization

### 1. Reuse Sessions

```bash
# Don't close between operations
agent-browser -p browserbase --session reused open https://example.com
agent-browser --session reused snapshot -i
agent-browser --session reused click @e1
# ...more operations...
agent-browser --session reused close  # Close when done
```

### 2. Use Local for Development

```bash
# Development - local
agent-browser open https://localhost:3000

# Production - cloud
agent-browser -p browserbase open https://production.example.com
```

### 3. Batch Operations

```bash
# Combine operations before close
agent-browser -p browserbase open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser wait --load networkidle
agent-browser screenshot /tmp/result.png
agent-browser get text body
agent-browser close  # Single session for all operations
```

## Troubleshooting

### Authentication Failed

```bash
# Verify API key
echo $BROWSERBASE_API_KEY

# Test with curl
curl -H "Authorization: Bearer $BROWSERBASE_API_KEY" \
    https://api.browserbase.com/v1/sessions
```

### Connection Timeout

```bash
# Increase timeout for cloud latency
agent-browser -p browserbase --timeout 60000 open https://example.com
```

### Session Not Found

```bash
# Cloud sessions may expire - always handle gracefully
agent-browser -p browserbase --session my-session open https://example.com || \
    agent-browser -p browserbase --session my-session-new open https://example.com
```
