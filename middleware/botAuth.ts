import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function botAuthMiddleware(req: NextRequest) {
  try {
    // Check for user authentication using getToken instead of getServerSession
    const token = await getToken({ req });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get bot ID from request headers or query params
    const botId = req.headers.get('x-bot-id') || req.nextUrl.searchParams.get('botId');
    if (!botId) {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }

    // Add bot ID to request headers for downstream handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-bot-id', botId);
    requestHeaders.set('x-user-email', token.email as string);

    // Clone the request with the new headers
    const newRequest = new Request(req.url, {
      method: req.method,
      headers: requestHeaders,
      body: req.body,
    });

    return NextResponse.next({
      request: newRequest,
    });
  } catch (error) {
    console.error('Bot authentication error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper to extract bot info from request
export function getBotInfo(req: Request) {
  const botId = req.headers.get('x-bot-id');
  const userEmail = req.headers.get('x-user-email');
  if (!botId || !userEmail) return null;
  
  return { botId, userEmail };
} 