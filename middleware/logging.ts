import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add a response listener
  response.headers.set('x-middleware-cache', 'no-cache');

  return response;
}

// Configure which paths to run the middleware on
export const config = {
  matcher: '/api/:path*',
}; 