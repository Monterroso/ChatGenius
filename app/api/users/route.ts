import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.error('Unauthorized', session);
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { rows: users } = await db.query(`
    SELECT 
      u.id,
      u.name,
      u.username,
      s.*
    FROM users u
    LEFT JOIN user_status s ON s.user_id = u.id
    WHERE u.id != $1
  `, [session.user.id]);

  // Transform users to include effective status
  const safeUsers = users.map(user => {
    const status = user.user_id ? calculateEffectiveStatus({
      user_id: user.user_id,
      manual_status: user.manual_status,
      invisible: user.invisible || false,
      last_seen: user.last_seen,
      devices: user.devices || []
    }) : null;

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      status: status?.status || 'offline',
      lastSeen: status?.lastSeen || user.last_seen || null
    };
  });

  return NextResponse.json(safeUsers);
}

