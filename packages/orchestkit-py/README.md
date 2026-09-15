# orchestkit

Official Python client for the [OrchestKit](https://orchestkit.yonyon.ai) public
docs API. Homepage: https://orchestkit.yonyon.ai

```bash
pip install orchestkit
```

```python
from orchestkit import create_client, search, ask, read_doc

client = create_client()
hits, rate = search(client, "hooks", limit=5)
print(hits[0].url, rate.remaining)
```

The API is public, read-only, and unauthenticated. See
https://orchestkit.yonyon.ai/sdk and https://orchestkit.yonyon.ai/api-policy.

Hook event schemas live in a different package: `orchestkit-hook-contract`.
