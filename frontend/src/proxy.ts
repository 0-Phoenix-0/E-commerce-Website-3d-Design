import { NextRequest, NextResponse } from 'next/server';

const CUSTOMER_ROUTES = ['/cart', '/checkout', '/orders', '/wishlist', '/profile'];

// Named export required by Next.js 16 (previously called "middleware")
export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;

  // Redirect authenticated users away from auth pages
  if (token && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Protect customer-only routes — redirect to login with ?next= for post-login redirect
  if (!token && CUSTOMER_ROUTES.some((r) => pathname.startsWith(r))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Protect admin routes
  if (pathname.startsWith('/admin') && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
