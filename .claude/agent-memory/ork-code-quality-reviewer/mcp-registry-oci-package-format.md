---
name: mcp-registry-oci-package-format
description: MCP registry rejects registryBaseUrl/version/fileSha256 on OCI packages — canonical tagged identifier only; GHCR images must be public for anonymous validation
metadata:
  type: project
---

The official MCP registry (registry.modelcontextprotocol.io) validates OCI packages in
`internal/validators/registries/oci.go` (`ValidateOCI`) and HARD-REJECTS the "old format":

- `registryBaseUrl` present → error "OCI packages must not have 'registryBaseUrl' field"
- `version` present → error "OCI packages must not have 'version' field"
- `fileSha256` present → error
- Required shape: canonical reference in `identifier` only, e.g.
  `ghcr.io/yonatangross/orchestkit-docs-mcp:8.36.2` (tag or digest embedded)
- Registry allowlist: docker.io, ghcr.io, quay.io, mcr.microsoft.com, *.pkg.dev, *.azurecr.io
- Image pulled with ANONYMOUS auth at publish time → private GHCR packages fail
  ("Only public images are supported"). First push to GHCR creates a PRIVATE package
  by default — one-time manual visibility flip to public is required.
- Ownership proof = `io.modelcontextprotocol.server.name` LABEL on the FINAL image stage
  must equal server.json `name`.

**Why:** PR #2385 (2026-06-11) shipped registryBaseUrl + version + untagged identifier —
schema 2025-12-11 accepts it (schema is generic across registry types) but the live
validator rejects it, so schema-validity is NOT publish-validity for OCI.

**How to apply:** When reviewing server.json `packages[]` with `registryType: "oci"`,
check against the validator, not the JSON schema. Version-bumping via release-please
`$.packages[0].version` jsonpath is incompatible with the canonical format (version
lives inside the identifier string) — tag injection must happen in the publish workflow
(jq) instead. Relates to [[skill-guard-scope-gaps]] era reviews of release plumbing.
