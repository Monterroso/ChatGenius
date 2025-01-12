import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { calculateEffectiveStatus } from '@/lib/status';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { rows: [status] } = await db.query(`
      SELECT * FROM user_status WHERE user_id = $1
    `, [userId]);

    if (!status) {
      return new NextResponse('Status not found', { status: 404 });
    }

    return NextResponse.json(calculateEffectiveStatus(status));
  } catch (error) {
    console.error('[Status API] GET - Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 