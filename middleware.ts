import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { botAuthMiddleware } from './middleware/botAuth';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/signup');

  // Bot-related routes that need authentication
  const BOT_ROUTES = [
    '/api/bots/chat',
    '/api/bots/knowledge',
    '/api/bots/commands'
  ];

  const path = request.nextUrl.pathname;

  // Apply bot authentication for bot-specific routes
  if (BOT_ROUTES.some(route => path.startsWith(route))) {
    return botAuthMiddleware(request);
  }

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
    '/signup',
    '/api/bots/chat/:path*',
    '/api/bots/knowledge/:path*',
    '/api/bots/commands/:path*'
  ],
}; 