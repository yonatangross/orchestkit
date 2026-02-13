---
name: create-openapi-spec
description: Create OpenAPI specification with auto-detected API endpoints. Use when creating API documentation.
user-invocable: true
argument-hint: [api-name]
---

Create OpenAPI spec: $ARGUMENTS

## API Context (Auto-Detected)

- **API Name**: $ARGUMENTS
- **Existing Endpoints**: !`grep -r "@router\.\|@app\.\|@api\.\|router\.get\|router\.post" . --include="*.py" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ' || echo "0"`
- **API Base URL**: !`grep -r "API_URL\|BASE_URL\|VITE_API" .env* 2>/dev/null | head -1 | cut -d'=' -f2 || echo "https://api.example.com"`
- **Framework**: !`grep -r "fastapi\|express\|next" package.json pyproject.toml 2>/dev/null | head -1 | grep -oE 'fastapi|express|next' || echo "FastAPI"`
- **Version**: !`grep -r '"version"' package.json pyproject.toml 2>/dev/null | head -1 | grep -oE '"[0-9]+\.[0-9]+\.[0-9]+"' || echo '"1.0.0"'`

## OpenAPI Specification

```yaml
openapi: 3.1.0

info:
  title: $ARGUMENTS
  version: !`grep -r '"version"' package.json pyproject.toml 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "1.0.0"`
  description: |
    API for $ARGUMENTS
    
    Generated: !`date +%Y-%m-%d`
    Framework: !`grep -r "fastapi\|express" package.json pyproject.toml 2>/dev/null | head -1 | grep -oE 'fastapi|express' || echo "Unknown"`

servers:
  - url: !`grep -r "API_URL\|BASE_URL" .env* 2>/dev/null | head -1 | cut -d'=' -f2 || echo "https://api.example.com/v1"`
    description: Production server
  - url: http://localhost:3000/v1
    description: Local development

paths:
  # Add your endpoints here
  # Detected endpoints: !`grep -r "@router\.\|router\.get\|router\.post" . --include="*.py" --include="*.ts" 2>/dev/null | head -5 || echo "None detected"`
```

## Usage

1. Review detected endpoints above
2. Add paths based on your routes
3. Save to: `openapi.yaml` or `api-spec.yaml`
