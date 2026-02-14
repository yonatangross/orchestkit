# Nixpacks Customization

Railway uses Nixpacks to auto-detect your stack and generate a build plan. Customize when auto-detection falls short.

## Auto-Detection

Nixpacks detects your language by looking for:

| Language | Detection File |
|----------|---------------|
| Node.js | `package.json` |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile` |
| Go | `go.mod` |
| Rust | `Cargo.toml` |
| Ruby | `Gemfile` |
| Java | `pom.xml`, `build.gradle` |
| PHP | `composer.json` |

## nixpacks.toml

Place at project root (or set `nixpacksConfigPath` in `railway.json` for monorepos).

### Adding System Packages

```toml
[phases.setup]
nixPkgs = ["...", "ffmpeg", "imagemagick", "poppler_utils"]
aptPkgs = ["libvips-dev"]
```

### Custom Build Phases

```toml
[phases.install]
cmds = ["npm ci --production=false"]

[phases.build]
cmds = [
  "npx prisma generate",
  "npm run build"
]
dependsOn = ["install"]

[start]
cmd = "npm run start:prod"
```

### Environment Variables in Build

```toml
[variables]
NODE_ENV = "production"
NEXT_TELEMETRY_DISABLED = "1"
```

## Monorepo Root Path

For monorepos, set the root directory per service in the Railway dashboard or via `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "nixpacksConfigPath": "apps/api/nixpacks.toml"
  }
}
```

Each service points to its own directory and `nixpacks.toml`.

## When to Switch to Dockerfile

Use Dockerfile instead of Nixpacks when:
- Multi-stage builds are needed to reduce image size
- Build requires conditional logic (e.g., `ARG`-based feature flags)
- Precise control over base image (e.g., distroless, Alpine variants)
- Nixpacks doesn't support a required system dependency

Set in `railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.production"
  }
}
```
