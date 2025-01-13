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

    const groupId = params.id;

    // Verify user's access to the group
    const memberCheck = await db.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, session.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all files for the group
    const result = await db.query(
      `SELECT f.*, u.name as uploader_name, u.username as uploader_username
       FROM files f
       JOIN users u ON f.uploader_id = u.id
       WHERE f.group_id = $1
       ORDER BY f.uploaded_at DESC`,
      [groupId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching group files:', error);
    return NextResponse.json(
      { error: 'Error fetching group files' },
      { status: 500 }
    );
  }
} 