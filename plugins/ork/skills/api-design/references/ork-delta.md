# ork delta: api-design

OrchestKit-specific decisions rescued during the wrap-plus-delta thinning of
src/skills/api-design (2026-07-31). Vendor and spec tutorials that used to live
beside these entries were deleted; the "Upstream coverage (do not restate)"
table in SKILL.md points at their first-party sources. Only rules with a house
decision or a scar behind them live here.

## Put problem type URIs on your own API domain under /problems/
Why: House convention carried since the error-handling-rfc9457 skill was consolidated into api-design v2.0.0 (metadata.json, February 2026). OrchestKit examples standardize on `https://api.orchestkit.dev/problems/<kebab-slug>` so error `type` URIs stay stable, documentable at their URL, and greppable across services (see examples/fastapi-problem-details.md for the full registry in use).
Upstream: RFC 9457 Problem Details, https://www.rfc-editor.org/rfc/rfc9457.html

## Raise typed Problem exceptions, never bare HTTPException
Why: House exception vocabulary (ProblemException base plus ResourceNotFoundError, ValidationError, ConflictError, RateLimitError, AuthenticationError, AuthorizationError, each carrying machine-readable extension members such as `resource_id` and `retry_after`) fixed at the v2.0.0 consolidation (February 2026). The agent-facing extensions from #1067 build on these same classes, and SKILL.md's quick start plus examples/fastapi-problem-details.md depend on them; ad-hoc HTTPException payloads broke error-format consistency across endpoints, which is what the consolidation was fixing.
Upstream: FastAPI custom exception handlers, https://fastapi.tiangolo.com/tutorial/handling-errors/

## Hold the deprecation window: 3 months notice, 6 months sunset, current + 1 supported
Why: House lifecycle policy set when the api-versioning skill was consolidated into api-design v2.0.0 (February 2026): deprecation notice at least 3 months before sunset, sunset 6 months after deprecation, support latest stable plus 1 previous version, and never more than 2-3 concurrent versions. These numbers are OrchestKit policy, not spec requirements; the specs only define the header mechanics. The policy is also mirrored in SKILL.md Key Decisions so it survives file-level thinning.
Upstream: RFC 8594 (Sunset header), https://www.rfc-editor.org/rfc/rfc8594.html and RFC 9745 (Deprecation header), https://www.rfc-editor.org/rfc/rfc9745.html
