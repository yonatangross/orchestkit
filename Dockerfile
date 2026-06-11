# OrchestKit Docs MCP server (stdio) — used by MCP registries (e.g. Glama) to
# boot the server and run introspection checks, and by anyone preferring a
# containerized stdio MCP client over the hosted Streamable HTTP endpoint at
# https://orchestkit.yonyon.ai/api/mcp.
#
#   docker build -t orchestkit-docs-mcp .
#   docker run -i --rm orchestkit-docs-mcp
#
# Tool listing works offline; tool calls fetch from the public docs API.

FROM node:22-alpine AS build
WORKDIR /app
COPY src/mcp-server/package.json src/mcp-server/package-lock.json ./
RUN npm ci
COPY src/mcp-server/tsconfig.json src/mcp-server/esbuild.config.mjs ./
COPY src/mcp-server/src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/docs-server.mjs ./docs-server.mjs
USER node
ENTRYPOINT ["node", "/app/docs-server.mjs"]
