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
  
  // Return the rows directly - they already have the correct format:
  // { user_id: string, presence: string, last_seen: string }[]
  return NextResponse.json(result.rows);
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

    // Use upsert and update last_seen timestamp
    await db.query(
      `INSERT INTO user_presence (user_id, presence, last_seen)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         presence = $2,
         last_seen = NOW()`,
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