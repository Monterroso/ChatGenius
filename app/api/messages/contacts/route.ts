import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Get unique user IDs from messages where the current user is either sender or receiver
    const users = await db.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sender_id = $1 THEN receiver_id
          ELSE sender_id
        END as user_id
      FROM messages
      WHERE sender_id = $1 OR receiver_id = $1
    `, [session.user.id]);

    return NextResponse.json(users.rows.map(row => row.user_id));
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 