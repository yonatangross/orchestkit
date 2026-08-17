# OrchestKit Docs MCP server (stdio) — used by MCP registries (e.g. Glama) to
# boot the server and run introspection checks, and by anyone preferring a
# containerized stdio MCP client over the hosted Streamable HTTP endpoint at
# https://orchestkit.yonyon.ai/api/mcp.
#
#   docker build -t orchestkit-docs-mcp .
#   docker run -i --rm orchestkit-docs-mcp
#
# Tool listing works offline; tool calls fetch from the public docs API.

# Digest-pinned (Scorecard Pinned-Dependencies; alerts #204/#206). The digest is
# the multi-arch manifest LIST for node:24-alpine, so amd64 and arm64 both stay
# covered by the one pin that release.yml pushes.
# Kept in step with .nvmrc and the root package.json engines range; the docker
# ecosystem in .github/dependabot.yml bumps it (#3477). To refresh manually:
#   docker buildx imagetools inspect node:24-alpine
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS build
WORKDIR /app
COPY src/mcp-server/package.json src/mcp-server/package-lock.json ./
RUN npm ci
COPY src/mcp-server/tsconfig.json src/mcp-server/esbuild.config.mjs ./
COPY src/mcp-server/src ./src
RUN npm run build

FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019
# MCP registry ownership validation, must match server.json "name"
LABEL io.modelcontextprotocol.server.name="io.github.yonatangross/orchestkit"
# Auto-links the GHCR package to this repo (grants Actions GITHUB_TOKEN write
# access to the package and surfaces the repo README on the package page).
LABEL org.opencontainers.image.source="https://github.com/yonatangross/orchestkit"
LABEL org.opencontainers.image.description="OrchestKit Docs MCP server (stdio) — docs search + Markdown fetch. linux/amd64 + linux/arm64."
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/docs-server.mjs ./docs-server.mjs
USER node
ENTRYPOINT ["node", "/app/docs-server.mjs"]
