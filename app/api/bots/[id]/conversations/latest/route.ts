import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get the latest active conversation for this bot and user
    const result = await db.query(
      `SELECT id 
       FROM bot_conversations 
       WHERE bot_id = $1 
         AND user_id = $2 
         AND status = 'active'
       ORDER BY last_interaction DESC 
       LIMIT 1`,
      [params.id, session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ conversationId: null });
    }

    return NextResponse.json({ conversationId: result.rows[0].id });
  } catch (error) {
    console.error('Error fetching latest conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 