# Vite SSR Configuration

Server-side rendering setup for development and production.

## Project Structure

```
project/
├── index.html
├── src/
│   ├── main.tsx           # Client entry
│   ├── entry-client.tsx   # Client-specific setup
│   ├── entry-server.tsx   # Server render function
│   └── App.tsx
├── server.js              # Production server
└── vite.config.ts
```

## Entry Points

### Client Entry (entry-client.tsx)

```tsx
import { hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

hydrateRoot(
  document.getElementById('root')!,
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
```

### Server Entry (entry-server.tsx)

```tsx
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import App from './App'

export function render(url: string) {
  return renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>
  )
}
```

## Development Server

```typescript
// server-dev.js
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createServer as createViteServer } from 'vite'

async function createServer() {
  const app = express()

  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  // Use Vite's middleware
  app.use(vite.middlewares)

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl

    try {
      // 1. Read index.html
      let template = fs.readFileSync(
        path.resolve('index.html'),
        'utf-8'
      )

      // 2. Apply Vite HTML transforms (HMR client, etc.)
      template = await vite.transformIndexHtml(url, template)

      // 3. Load server entry with HMR support
      const { render } = await vite.ssrLoadModule('/src/entry-server.tsx')

      // 4. Render app HTML
      const appHtml = await render(url)

      // 5. Inject into template
      const html = template.replace('<!--ssr-outlet-->', appHtml)

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e as Error)
      next(e)
    }
  })

  app.listen(5173)
}

createServer()
```

## Production Build

### Build Scripts (package.json)

```json
{
  "scripts": {
    "dev": "node server-dev.js",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --outDir dist/server --ssr src/entry-server.tsx",
    "preview": "node server-prod.js"
  }
}
```

### Production Server

```typescript
// server-prod.js
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'

const app = express()

// Serve static assets
app.use(express.static('dist/client', { index: false }))

app.use('*', async (req, res) => {
  const url = req.originalUrl

  // Read pre-built template
  const template = fs.readFileSync(
    path.resolve('dist/client/index.html'),
    'utf-8'
  )

  // Import pre-built server bundle
  const { render } = await import('./dist/server/entry-server.js')

  const appHtml = await render(url)
  const html = template.replace('<!--ssr-outlet-->', appHtml)

  res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
})

app.listen(3000)
```

## Vite Config for SSR

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  build: {
    // Shared build options
    sourcemap: true,
  },

  // SSR-specific options
  ssr: {
    // Externalize dependencies (not bundled)
    external: ['express'],

    // Force bundle specific packages
    noExternal: ['some-ssr-unfriendly-package'],
  },
})
```

## Vite 7 Environment API (Alternative)

```typescript
export default defineConfig({
  environments: {
    client: {
      build: {
        outDir: 'dist/client',
        manifest: true,
      },
    },
    ssr: {
      build: {
        outDir: 'dist/server',
        ssr: 'src/entry-server.tsx',
        target: 'node20',
      },
    },
  },
})
```

## Streaming SSR

```tsx
// entry-server.tsx with streaming
import { renderToPipeableStream } from 'react-dom/server'

export function render(url: string, res: Response) {
  const { pipe, abort } = renderToPipeableStream(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
    {
      onShellReady() {
        res.setHeader('Content-Type', 'text/html')
        pipe(res)
      },
      onError(error) {
        console.error(error)
      },
    }
  )

  setTimeout(abort, 10000) // Timeout
}
```

## index.html Template

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SSR App</title>
  </head>
  <body>
    <div id="root"><!--ssr-outlet--></div>
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>
```
