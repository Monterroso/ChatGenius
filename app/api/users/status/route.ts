import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';
import { io } from '@/scripts/socket-server';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { rows: [status] } = await db.query(`
    SELECT * FROM user_status WHERE user_id = $1
  `, [session.user.id]);

  if (!status) {
    console.log(`Status not found for user ${session.user.id}`);
    return new NextResponse('Status not found', { status: 404 });
  }

  return NextResponse.json(calculateEffectiveStatus(status));
}

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { status } = await req.json();

  const { rows: [result] } = await db.query(`
    INSERT INTO user_status (user_id, manual_status, last_seen)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET manual_status = $2, last_seen = CURRENT_TIMESTAMP
    RETURNING *
  `, [session.user.id, status]);

  const effectiveStatus = calculateEffectiveStatus(result);
  io.emit('statusChanged', effectiveStatus);

  return NextResponse.json(effectiveStatus);
} 