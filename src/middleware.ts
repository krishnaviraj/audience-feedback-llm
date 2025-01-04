import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimitMiddleware } from './lib/rate-limit'

// Define allowed origins
const allowedOrigins = [
  'http://localhost:3000',        // Local development
  'http://localhost:3001',        // Local testing
  process.env.NEXT_PUBLIC_SITE_URL, // Production URL
].filter(Boolean)

export async function middleware(request: NextRequest) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request.headers.get('origin') || '')
    })
  }

  // Only apply rate limiting to specific routes
  // Skip rate limiting for /api/ip endpoint
  if (request.nextUrl.pathname.startsWith('/api/summarize')) {
    // More permissive rate limiting for summary generation
    const response = await rateLimitMiddleware(request, {
      windowMs: 60 * 1000,       // 1 minute
      max: 30,                   // 30 requests per minute
      message: 'Too many summary requests, please try again later'
    });
    if (response.status === 429) return response;
  }

  // Get base response
  const response = NextResponse.next()

  // Add security headers to all responses
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
  
  // Add Content-Security-Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co", // Added wss for WebSocket
      "frame-ancestors 'none'",
    ].join('; ')
  )

  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || ''
    Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
  }

  return response
}

// Helper function to generate CORS headers
function getCorsHeaders(origin: string) {
  const headers: { [key: string]: string } = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
    'Access-Control-Max-Age': '86400',
  }

  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else {
    headers['Access-Control-Allow-Origin'] = allowedOrigins[0] || ''
  }

  return headers
}

// Configure which paths should be processed by this middleware
export const config = {
  matcher: [
    '/api/:path*',  // Only apply to API routes
  ],
}