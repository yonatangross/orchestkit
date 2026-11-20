# OrchestKit Go SDK

Official Go client for the [OrchestKit](https://orchestkit.dev) public
docs API.

Homepage: https://orchestkit.dev

```
go get github.com/yonatangross/orchestkit/sdk
```

```go
c := sdk.NewClient()
hits, rate, err := c.Search("hooks", 5)
```

The API is public, read-only, and unauthenticated. See
https://orchestkit.dev/sdk
