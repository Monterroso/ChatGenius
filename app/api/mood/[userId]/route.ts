import db from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const mood = await db.query(
      'SELECT * FROM user_moods WHERE user_id = $1',
      [params.userId]
    );

    if (!mood.rows[0]) {
      return NextResponse.json({ error: 'Mood not found' }, { status: 404 });
    }

    return NextResponse.json(mood.rows[0]);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch mood' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.id !== params.userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await db.query('DELETE FROM user_moods WHERE user_id = $1', [params.userId]);
    return NextResponse.json({ message: 'Mood deleted' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete mood' },
      { status: 500 }
    );
  }
} 