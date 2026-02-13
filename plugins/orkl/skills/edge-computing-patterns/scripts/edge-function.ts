/**
 * Edge Function Template
 *
 * A production-ready edge function template with error handling,
 * validation, caching, and observability.
 *
 * Compatible with: Cloudflare Workers, Vercel Edge, Deno Deploy
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

interface Env {
  // Environment variables (Cloudflare Workers style)
  API_KEY?: string
  DATABASE_URL?: string
  CACHE_KV?: KVNamespace // Cloudflare KV
  RATE_LIMIT?: DurableObjectNamespace // Cloudflare Durable Objects
}

interface RequestContext {
  request: Request
  env: Env
  waitUntil?: (promise: Promise<any>) => void // Background tasks
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  CACHE_TTL: 300, // 5 minutes
  MAX_REQUEST_SIZE: 1024 * 1024, // 1MB
  ALLOWED_ORIGINS: ['https://example.com', 'https://app.example.com'],
  RATE_LIMIT: {
    REQUESTS: 100,
    WINDOW: 60 // seconds
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    const context: RequestContext = {
      request,
      env,
      waitUntil: ctx?.waitUntil
    }

    try {
      // CORS preflight
      if (request.method === 'OPTIONS') {
        return handleCORS(request)
      }

      // Validate request
      const validation = await validateRequest(request)
      if (!validation.valid) {
        return jsonResponse({ success: false, error: validation.error }, 400)
      }

      // Rate limiting (if enabled)
      if (env.RATE_LIMIT) {
        const rateLimitResult = await checkRateLimit(request, env)
        if (!rateLimitResult.allowed) {
          return jsonResponse(
            { success: false, error: 'Rate limit exceeded' },
            429,
            { 'Retry-After': rateLimitResult.retryAfter.toString() }
          )
        }
      }

      // Route request
      const response = await routeRequest(context)

      // Add CORS headers
      return addCORSHeaders(response, request)

    } catch (error) {
      // Error handling with logging
      console.error('Edge function error:', error)

      // Background error reporting (non-blocking)
      if (context.waitUntil) {
        context.waitUntil(reportError(error, request, env))
      }

      return jsonResponse(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        },
        500
      )
    }
  }
}

// ============================================================================
// Request Routing
// ============================================================================

async function routeRequest(ctx: RequestContext): Promise<Response> {
  const { request, env } = ctx
  const url = new URL(request.url)
  const path = url.pathname

  // API routes
  if (path.startsWith('/api/')) {
    return handleApiRequest(request, env)
  }

  // Health check
  if (path === '/health') {
    return jsonResponse({ success: true, status: 'healthy' })
  }

  // Default: proxy to origin or return 404
  return jsonResponse({ success: false, error: 'Not found' }, 404)
}

// ============================================================================
// API Handler
// ============================================================================

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const endpoint = url.pathname.replace('/api/', '')

  switch (endpoint) {
    case 'hello':
      return handleHello(request)

    case 'data':
      return handleData(request, env)

    case 'proxy':
      return handleProxy(request, env)

    default:
      return jsonResponse({ success: false, error: 'Unknown endpoint' }, 404)
  }
}

// ============================================================================
// Endpoint Handlers
// ============================================================================

async function handleHello(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const name = url.searchParams.get('name') || 'World'

  return jsonResponse({
    success: true,
    data: {
      message: `Hello, ${name}!`,
      timestamp: Date.now()
    }
  })
}

async function handleData(request: Request, env: Env): Promise<Response> {
  // Try cache first
  if (env.CACHE_KV) {
    const cached = await env.CACHE_KV.get('data', 'json')
    if (cached) {
      return jsonResponse({
        success: true,
        data: cached,
        cached: true
      })
    }
  }

  // Fetch fresh data
  const data = await fetchData(env)

  // Cache for future requests (background task)
  if (env.CACHE_KV) {
    await env.CACHE_KV.put('data', JSON.stringify(data), {
      expirationTtl: CONFIG.CACHE_TTL
    })
  }

  return jsonResponse({
    success: true,
    data,
    cached: false
  })
}

async function handleProxy(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return jsonResponse({ success: false, error: 'Missing url parameter' }, 400)
  }

  // Security: validate target URL
  try {
    const target = new URL(targetUrl)
    if (!['http:', 'https:'].includes(target.protocol)) {
      throw new Error('Invalid protocol')
    }
  } catch {
    return jsonResponse({ success: false, error: 'Invalid URL' }, 400)
  }

  // Proxy request with timeout
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'User-Agent': 'Edge-Proxy/1.0',
        'Authorization': request.headers.get('Authorization') || ''
      },
      signal: controller.signal
    })

    clearTimeout(timeout)

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    })
  } catch (error) {
    clearTimeout(timeout)
    return jsonResponse({ success: false, error: 'Proxy request failed' }, 502)
  }
}

// ============================================================================
// Validation
// ============================================================================

interface ValidationResult {
  valid: boolean
  error?: string
}

async function validateRequest(request: Request): Promise<ValidationResult> {
  // Check request size
  const contentLength = request.headers.get('Content-Length')
  if (contentLength && parseInt(contentLength) > CONFIG.MAX_REQUEST_SIZE) {
    return { valid: false, error: 'Request too large' }
  }

  // Validate content type for POST/PUT
  if (['POST', 'PUT'].includes(request.method)) {
    const contentType = request.headers.get('Content-Type')
    if (!contentType?.includes('application/json')) {
      return { valid: false, error: 'Content-Type must be application/json' }
    }
  }

  return { valid: true }
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitResult {
  allowed: boolean
  retryAfter: number
}

async function checkRateLimit(request: Request, env: Env): Promise<RateLimitResult> {
  // Get client identifier (IP or API key)
  const clientId = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   'unknown'

  const key = `ratelimit:${clientId}`

  // Simple KV-based rate limiting
  if (env.CACHE_KV) {
    const count = await env.CACHE_KV.get(key)
    const currentCount = count ? parseInt(count) : 0

    if (currentCount >= CONFIG.RATE_LIMIT.REQUESTS) {
      return { allowed: false, retryAfter: CONFIG.RATE_LIMIT.WINDOW }
    }

    await env.CACHE_KV.put(key, (currentCount + 1).toString(), {
      expirationTtl: CONFIG.RATE_LIMIT.WINDOW
    })
  }

  return { allowed: true, retryAfter: 0 }
}

// ============================================================================
// CORS Handling
// ============================================================================

function handleCORS(request: Request): Response {
  const origin = request.headers.get('Origin') || ''

  if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  return new Response('Forbidden', { status: 403 })
}

function addCORSHeaders(response: Response, request: Request): Response {
  const origin = request.headers.get('Origin') || ''

  if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Access-Control-Allow-Origin', origin)
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    return newResponse
  }

  return response
}

// ============================================================================
// Utilities
// ============================================================================

function jsonResponse<T>(
  data: ApiResponse<T>,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ ...data, timestamp: Date.now() }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  })
}

async function fetchData(env: Env): Promise<any> {
  // Example: fetch from external API
  const response = await fetch('https://api.example.com/data', {
    headers: {
      'Authorization': `Bearer ${env.API_KEY || ''}`
    }
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}

async function reportError(error: unknown, request: Request, env: Env): Promise<void> {
  // Example: send error to logging service (non-blocking)
  try {
    await fetch('https://logging.example.com/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: request.url,
        method: request.method,
        timestamp: Date.now()
      })
    })
  } catch (logError) {
    // Ignore logging errors
    console.error('Failed to report error:', logError)
  }
}
