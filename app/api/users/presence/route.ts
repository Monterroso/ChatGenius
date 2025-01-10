import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import db from '@/lib/db';

// Get all user presences (excluding invisible users)
export async function GET() {
  const result = await db.query(
    `SELECT user_id, presence, last_seen 
     FROM user_presence 
     WHERE presence != $1`,
    ['invisible']
  );
  
  const userPresences = result.rows.reduce((acc, user) => {
    acc[user.user_id] = {
      presence: user.presence,
      lastSeen: user.last_seen
    };
    return acc;
  }, {});

  return NextResponse.json(userPresences);
}

// Update user presence
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { presence } = await request.json();

    // Validate presence value
    const validPresences = ['online', 'offline', 'away', 'busy', 'invisible'];
    if (!validPresences.includes(presence)) {
      return NextResponse.json(
        { error: 'Invalid presence value' },
        { status: 400 }
      );
    }

    // Use upsert (INSERT ... ON CONFLICT DO UPDATE) to handle both creation and updates
    await db.query(
      `INSERT INTO user_presence (user_id, presence)
       VALUES ($1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET presence = $2`,
      [session.user.id, presence]
    );

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating user presence:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 