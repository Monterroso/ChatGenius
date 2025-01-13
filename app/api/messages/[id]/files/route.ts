import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = params.id;

    // Get files shared between these users
    const result = await db.query(
      `SELECT f.*, u.username as uploader_username
       FROM files f
       JOIN users u ON f.uploader_id = u.id
       WHERE (f.uploader_id = $1 AND f.receivex r_id = $2)
          OR (f.uploader_id = $2 AND f.receiver_id = $1)
       ORDER BY f.uploaded_at DESC`,
      [session.user.id, userId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'Error fetching files' },
      { status: 500 }
    );
  }
} 