/**
 * Edge Middleware Template (Next.js / Vercel)
 *
 * Production-ready middleware patterns for authentication, routing,
 * A/B testing, geolocation, and request transformation.
 *
 * Compatible with: Next.js 13+, Vercel Edge Runtime
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  AUTH: {
    PUBLIC_PATHS: ['/login', '/signup', '/forgot-password'],
    AUTH_COOKIE: 'auth-token',
    SESSION_MAX_AGE: 60 * 60 * 24 * 7 // 7 days
  },
  AB_TEST: {
    ENABLED: true,
    COOKIE: 'ab-test-variant',
    VARIANTS: ['control', 'variant-a', 'variant-b'] as const,
    WEIGHTS: [0.33, 0.33, 0.34] // Must sum to 1.0
  },
  GEO: {
    EU_COUNTRIES: ['DE', 'FR', 'IT', 'ES', 'NL', 'GB', 'PL', 'BE', 'SE', 'AT'],
    BLOCKED_COUNTRIES: [] as string[]
  },
  RATE_LIMIT: {
    ENABLED: false, // Use edge config or KV for production
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000
  }
}

// ============================================================================
// Main Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const path = url.pathname

  // 1. Health check (bypass all middleware)
  if (path === '/health') {
    return NextResponse.json({ status: 'healthy', timestamp: Date.now() })
  }

  // 2. Geo-blocking
  const geoCheck = checkGeolocation(request)
  if (!geoCheck.allowed) {
    return NextResponse.json(
      { error: 'Service not available in your region' },
      { status: 403 }
    )
  }

  // 3. Rate limiting (if enabled)
  if (CONFIG.RATE_LIMIT.ENABLED) {
    const rateLimitCheck = await checkRateLimit(request)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': '60' }
        }
      )
    }
  }

  // 4. Authentication (for protected routes)
  if (requiresAuth(path)) {
    const authCheck = await checkAuthentication(request)
    if (!authCheck.authenticated) {
      return redirectToLogin(url, path)
    }

    // Add user info to headers for downstream use
    const response = NextResponse.next()
    response.headers.set('X-User-Id', authCheck.userId || '')
    return response
  }

  // 5. A/B Testing (for experiment paths)
  if (isExperimentPath(path)) {
    return handleABTest(request, url)
  }

  // 6. Request rewriting (for localized content)
  if (shouldLocalize(path)) {
    return handleLocalization(request, url)
  }

  // 7. Add standard headers
  const response = NextResponse.next()
  addSecurityHeaders(response)
  addGeoHeaders(response, request)

  return response
}

// ============================================================================
// Matcher Configuration
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}

// ============================================================================
// Authentication
// ============================================================================

interface AuthResult {
  authenticated: boolean
  userId?: string
  error?: string
}

function requiresAuth(path: string): boolean {
  // Public paths don't require auth
  if (CONFIG.AUTH.PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return false
  }

  // Protected paths
  return (
    path.startsWith('/dashboard') ||
    path.startsWith('/api/private') ||
    path.startsWith('/account')
  )
}

async function checkAuthentication(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get(CONFIG.AUTH.AUTH_COOKIE)?.value

  if (!token) {
    return { authenticated: false, error: 'No token' }
  }

  // Verify JWT at edge (lightweight, no database)
  try {
    const payload = await verifyJWT(token)
    return { authenticated: true, userId: payload.sub }
  } catch (error) {
    return { authenticated: false, error: 'Invalid token' }
  }
}

function redirectToLogin(url: URL, currentPath: string): NextResponse {
  const loginUrl = new URL('/login', url.origin)
  loginUrl.searchParams.set('redirect', currentPath)
  return NextResponse.redirect(loginUrl)
}

// Lightweight JWT verification (edge-compatible)
async function verifyJWT(token: string): Promise<{ sub: string; exp: number }> {
  const [headerB64, payloadB64, signatureB64] = token.split('.')

  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error('Invalid token format')
  }

  // Decode payload
  const payload = JSON.parse(atob(payloadB64))

  // Check expiration
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error('Token expired')
  }

  // Note: In production, verify signature with Web Crypto API
  // const secret = await getSigningKey()
  // const isValid = await crypto.subtle.verify(...)

  return payload
}

// ============================================================================
// A/B Testing
// ============================================================================

type ABVariant = typeof CONFIG.AB_TEST.VARIANTS[number]

function isExperimentPath(path: string): boolean {
  return (
    path.startsWith('/landing') ||
    path.startsWith('/pricing') ||
    path === '/'
  )
}

function handleABTest(request: NextRequest, url: URL): NextResponse {
  if (!CONFIG.AB_TEST.ENABLED) {
    return NextResponse.next()
  }

  // Check existing variant cookie
  let variant = request.cookies.get(CONFIG.AB_TEST.COOKIE)?.value as ABVariant | undefined

  // Assign new variant if none exists
  if (!variant || !CONFIG.AB_TEST.VARIANTS.includes(variant)) {
    variant = assignVariant()
  }

  // Rewrite to variant-specific path
  if (variant !== 'control') {
    url.pathname = `/${variant}${url.pathname}`
  }

  const response = NextResponse.rewrite(url)

  // Set persistent variant cookie
  response.cookies.set(CONFIG.AB_TEST.COOKIE, variant, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  })

  // Add variant header for analytics
  response.headers.set('X-AB-Variant', variant)

  return response
}

function assignVariant(): ABVariant {
  const random = Math.random()
  let cumulative = 0

  for (let i = 0; i < CONFIG.AB_TEST.VARIANTS.length; i++) {
    cumulative += CONFIG.AB_TEST.WEIGHTS[i]
    if (random < cumulative) {
      return CONFIG.AB_TEST.VARIANTS[i]
    }
  }

  return CONFIG.AB_TEST.VARIANTS[0] // Fallback
}

// ============================================================================
// Geolocation
// ============================================================================

interface GeoResult {
  allowed: boolean
  country?: string
  reason?: string
}

function checkGeolocation(request: NextRequest): GeoResult {
  const country = request.geo?.country || 'US'

  // Block specific countries
  if (CONFIG.GEO.BLOCKED_COUNTRIES.includes(country)) {
    return { allowed: false, country, reason: 'Geo-blocked' }
  }

  return { allowed: true, country }
}

function shouldLocalize(path: string): boolean {
  // Don't localize API routes or static assets
  if (path.startsWith('/api') || path.startsWith('/_next')) {
    return false
  }

  return true
}

function handleLocalization(request: NextRequest, url: URL): NextResponse {
  const country = request.geo?.country || 'US'

  // EU countries get GDPR-compliant version
  if (CONFIG.GEO.EU_COUNTRIES.includes(country)) {
    url.pathname = `/eu${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

function addGeoHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set('X-User-Country', request.geo?.country || 'Unknown')
  response.headers.set('X-User-City', request.geo?.city || 'Unknown')
  response.headers.set('X-User-Region', request.geo?.region || 'Unknown')
  response.headers.set('X-User-Latitude', request.geo?.latitude || '0')
  response.headers.set('X-User-Longitude', request.geo?.longitude || '0')
}

// ============================================================================
// Rate Limiting (Simple In-Memory)
// ============================================================================

// Note: For production, use Vercel Edge Config, Upstash Redis, or Cloudflare KV
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

interface RateLimitResult {
  allowed: boolean
  retryAfter?: number
}

async function checkRateLimit(request: NextRequest): Promise<RateLimitResult> {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const key = `ratelimit:${ip}`

  const now = Date.now()
  const existing = rateLimitStore.get(key)

  // Reset if window expired
  if (!existing || existing.resetAt < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + CONFIG.RATE_LIMIT.WINDOW_MS
    })
    return { allowed: true }
  }

  // Increment count
  existing.count++

  if (existing.count > CONFIG.RATE_LIMIT.MAX_REQUESTS) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

// ============================================================================
// Security Headers
// ============================================================================

function addSecurityHeaders(response: NextResponse) {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Enable XSS protection
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  // Content Security Policy (basic example)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  )
}

// ============================================================================
// Request Rewriting Examples
// ============================================================================

// Feature flag routing (requires Vercel Edge Config)
export async function featureFlagMiddleware(request: NextRequest) {
  // Uncomment when using @vercel/edge-config
  // import { get } from '@vercel/edge-config'
  //
  // const enableNewUI = await get('enable_new_ui')
  //
  // if (enableNewUI) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = `/new-ui${url.pathname}`
  //   return NextResponse.rewrite(url)
  // }

  return NextResponse.next()
}

// Mobile detection and routing
export function mobileMiddleware(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || ''
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(userAgent)

  if (isMobile && !request.nextUrl.pathname.startsWith('/mobile')) {
    const url = request.nextUrl.clone()
    url.pathname = `/mobile${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

// Custom domain routing
export function domainMiddleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  if (hostname.startsWith('app.')) {
    const url = request.nextUrl.clone()
    url.pathname = `/app${url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (hostname.startsWith('api.')) {
    const url = request.nextUrl.clone()
    url.pathname = `/api${url.pathname}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
