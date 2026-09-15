# OrchestKit Go SDK

Official Go client for the [OrchestKit](https://orchestkit.yonyon.ai) public
docs API.

Homepage: https://orchestkit.yonyon.ai

```
go get github.com/yonatangross/orchestkit/sdk
```

```go
c := sdk.NewClient()
hits, rate, err := c.Search("hooks", 5)
```

The API is public, read-only, and unauthenticated. See
https://orchestkit.yonyon.ai/sdk
