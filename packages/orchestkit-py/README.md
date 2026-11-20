# orchestkit

Official Python client for the [OrchestKit](https://orchestkit.dev) public
docs API. Homepage: https://orchestkit.dev

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
https://orchestkit.dev/sdk and https://orchestkit.dev/api-policy.

Hook event schemas live in a different package: `orchestkit-hook-contract`.
