import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { calculateEffectiveStatus } from '@/lib/status';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = params;

    // Get user's status from database
    const result = await db.query(
      `SELECT * FROM user_status WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User status not found' }, { status: 404 });
    }

    const userStatus = result.rows[0];
    
    // Calculate effective status using existing function
    const effectiveStatus = calculateEffectiveStatus(userStatus);

    return NextResponse.json(effectiveStatus);
  } catch (error) {
    console.error('Error getting user status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 