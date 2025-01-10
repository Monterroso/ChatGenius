import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/signup');

  // If trying to access auth pages while logged in, redirect to chat
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/chat', request.url));
  }

  // If trying to access protected pages while logged out, redirect to login
  if (!isAuthPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/chat/:path*',
    '/login',
    '/signup'
  ]
}; 