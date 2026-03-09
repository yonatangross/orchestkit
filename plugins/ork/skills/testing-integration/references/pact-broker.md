# Pact Broker Integration

## Broker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Pact Broker                          │
├─────────────────────────────────────────────────────────────┤
│  Contracts DB    │  Verification Results  │  Webhooks       │
│  - Consumer pacts│  - Provider versions   │  - CI triggers  │
│  - Versions      │  - Success/failure     │  - Slack alerts │
│  - Tags/branches │  - Timestamps          │  - Deployments  │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                      │
         │                    │                      ↓
    ┌────┴────┐          ┌────┴────┐          ┌─────────┐
    │ Consumer │          │ Provider│          │   CI    │
    │  Tests   │          │  Tests  │          │ Pipeline│
    └──────────┘          └─────────┘          └─────────┘
```

## Publishing Pacts

```bash
# Publish after consumer tests
pact-broker publish ./pacts \
  --broker-base-url="$PACT_BROKER_URL" \
  --broker-token="$PACT_BROKER_TOKEN" \
  --consumer-app-version="$GIT_SHA" \
  --branch="$GIT_BRANCH" \
  --tag-with-git-branch
```

## Can-I-Deploy Check

```bash
# Before deploying consumer
pact-broker can-i-deploy \
  --pacticipant=OrderService \
  --version="$GIT_SHA" \
  --to-environment=production \
  --broker-base-url="$PACT_BROKER_URL"

# Check specific provider compatibility
pact-broker can-i-deploy \
  --pacticipant=OrderService \
  --version="$GIT_SHA" \
  --pacticipant=UserService \
  --latest \
  --broker-base-url="$PACT_BROKER_URL"
```

## Recording Deployments

```bash
# After successful deployment
pact-broker record-deployment \
  --pacticipant=OrderService \
  --version="$GIT_SHA" \
  --environment=production \
  --broker-base-url="$PACT_BROKER_URL"

# Record release (for versioned releases)
pact-broker record-release \
  --pacticipant=OrderService \
  --version="1.2.3" \
  --environment=production \
  --broker-base-url="$PACT_BROKER_URL"
```

## GitHub Actions Workflow

```yaml
# .github/workflows/contracts.yml
name: Contract Tests

on:
  push:
    branches: [main, develop]
  pull_request:

env:
  PACT_BROKER_URL: ${{ secrets.PACT_BROKER_URL }}
  PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}

jobs:
  consumer-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run consumer tests
        run: pytest tests/contracts/consumer/ -v

      - name: Publish pacts
        run: |
          pact-broker publish ./pacts \
            --broker-base-url="$PACT_BROKER_URL" \
            --broker-token="$PACT_BROKER_TOKEN" \
            --consumer-app-version="${{ github.sha }}" \
            --branch="${{ github.ref_name }}"

  provider-verification:
    runs-on: ubuntu-latest
    needs: consumer-contracts
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker compose up -d api db

      - name: Verify provider
        run: |
          pytest tests/contracts/provider/ \
            --provider-version="${{ github.sha }}" \
            --publish-verification

      - name: Can I deploy?
        run: |
          pact-broker can-i-deploy \
            --pacticipant=UserService \
            --version="${{ github.sha }}" \
            --to-environment=production

  deploy:
    needs: [consumer-contracts, provider-verification]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: ./deploy.sh

      - name: Record deployment
        run: |
          pact-broker record-deployment \
            --pacticipant=UserService \
            --version="${{ github.sha }}" \
            --environment=production
```

## Webhooks Configuration

```json
{
  "description": "Trigger provider build on pact change",
  "provider": { "name": "UserService" },
  "events": [
    { "name": "contract_content_changed" }
  ],
  "request": {
    "method": "POST",
    "url": "https://api.github.com/repos/org/provider/dispatches",
    "headers": {
      "Authorization": "token ${user.githubToken}",
      "Content-Type": "application/json"
    },
    "body": {
      "event_type": "pact_changed",
      "client_payload": {
        "pact_url": "${pactbroker.pactUrl}"
      }
    }
  }
}
```

## Consumer Version Selectors

```python
# For provider verification
consumer_version_selectors = [
    # Verify against main branch
    {"mainBranch": True},

    # Verify against deployed/released versions
    {"deployedOrReleased": True},

    # Verify against specific environment
    {"deployed": True, "environment": "production"},

    # Verify against matching branch (for feature branches)
    {"matchingBranch": True},
]
```
