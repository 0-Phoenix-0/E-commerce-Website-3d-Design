import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Temporary proxy for debugging.
// All authentication will be handled by the React app and backend.
export function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};