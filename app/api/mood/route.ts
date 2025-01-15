import db from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { mood } = await request.json();

    if (!mood) {
      return NextResponse.json(
        { error: 'Mood is required' },
        { status: 400 }
      );
    }

    // Using upsert to either insert new mood or update existing one
    const result = await db.query(
      `
      INSERT INTO user_moods (user_id, mood)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET
        mood = EXCLUDED.mood,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [session.user.id, mood]
    );

    // Emit socket event for real-time updates
    // You can integrate this with your socket server later
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update mood' },
      { status: 500 }
    );
  }
} 