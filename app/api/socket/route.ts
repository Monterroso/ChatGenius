import { NextResponse } from 'next/server';

export async function GET() {
  // Return the Socket.IO server URL
  const socketUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost') + ':' + (process.env.SOCKET_PORT || '3001');
  console.log("socketUrl", socketUrl)
  return new NextResponse(JSON.stringify({ socketUrl }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export const dynamic = 'force-dynamic'; 