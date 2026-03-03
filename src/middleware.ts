import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const publicPaths = ['/login', '/activate', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and API auth routes
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Allow API routes (they handle their own auth)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const token = await getToken({ req: request })

  // Not authenticated -> login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const roles = (token.roles as string[]) || []

  // Admin routes require ADMIN role
  if (pathname.startsWith('/admin')) {
    if (!roles.includes('ADMIN')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Ordering and receiving require ADMIN or LOGISTICS
  if (pathname.startsWith('/products') || pathname.startsWith('/cart') || pathname.startsWith('/receiving')) {
    if (!roles.includes('ADMIN') && !roles.includes('LOGISTICS')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Invoices require ADMIN or FINANCE
  if (pathname.startsWith('/invoices')) {
    if (!roles.includes('ADMIN') && !roles.includes('FINANCE')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
