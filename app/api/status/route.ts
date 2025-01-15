import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import db from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { calculateEffectiveStatus } from '@/lib/status';

// GET /api/status/[userId]
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

// PUT /api/status
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    
    // Validate the status if provided
    if (body.manual_status && !['online', 'away', 'dnd', 'offline'].includes(body.manual_status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Get current user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Update or insert user status
    const result = await db.query(
      `INSERT INTO user_status (
        user_id,
        manual_status,
        invisible,
        last_seen,
        devices
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        manual_status = EXCLUDED.manual_status,
        invisible = COALESCE($3, user_status.invisible),
        last_seen = CURRENT_TIMESTAMP,
        devices = 
          CASE 
            WHEN user_status.devices IS NULL THEN $4
            ELSE (
              SELECT jsonb_agg(device)
              FROM (
                SELECT DISTINCT ON (d->>'id') d.*
                FROM jsonb_array_elements(user_status.devices || $4) d
                ORDER BY (d->>'id'), (d->>'last_active') DESC
              ) device
            )
          END
      RETURNING *`,
      [
        userId,
        body.manual_status || null,
        body.invisible || false,
        JSON.stringify([{
          id: userId + '-' + Date.now(),
          last_active: new Date().toISOString(),
          user_agent: userAgent
        }])
      ]
    );

    const updatedStatus = result.rows[0];
    
    // Calculate and return effective status using existing function
    const effectiveStatus = calculateEffectiveStatus(updatedStatus);

    return NextResponse.json(effectiveStatus);
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 