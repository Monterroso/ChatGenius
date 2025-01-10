import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import db from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { status } = await request.json();

    // Check status length
    const MAX_STATUS_LENGTH = 50;
    if (status.length > MAX_STATUS_LENGTH) {
      return NextResponse.json(
        { error: `Status must be ${MAX_STATUS_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Upsert the status using pg
    await db.query(
      `INSERT INTO user_status (user_id, status)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET status = $2`,
      [session.user.id, status]
    );

    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('Error setting user status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 