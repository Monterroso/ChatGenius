import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Thread name is required' }, { status: 400 });
    }

    // Check if parent group exists and user is a member
    const membership = await db.query(
      `SELECT 1 FROM group_members 
       WHERE group_id = $1 AND user_id = $2`,
      [params.id, session.user.id]
    );

    if (!membership.rows.length) {
      return NextResponse.json(
        { error: 'Parent group not found or user is not a member' },
        { status: 404 }
      );
    }

    // Check for duplicate thread names in the same parent group
    const existingThread = await db.query(
      `SELECT 1 FROM groups 
       WHERE parent_group_id = $1 AND LOWER(name) = LOWER($2)`,
      [params.id, name.trim()]
    );

    if (existingThread.rows.length) {
      return NextResponse.json(
        { error: 'A thread with this name already exists in this group' },
        { status: 409 }
      );
    }

    // Create the thread
    const result = await db.query(
      `INSERT INTO groups (name, parent_group_id)
       VALUES ($1, $2)
       RETURNING id, name, created_at, parent_group_id`,
      [name.trim(), params.id]
    );

    // Add the creator as a member of the thread
    await db.query(
      `INSERT INTO group_members (user_id, group_id)
       VALUES ($1, $2)`,
      [session.user.id, result.rows[0].id]
    );

    // Create a system message in the parent group about thread creation
    await db.query(
      `INSERT INTO messages (content, sender_id, group_id)
       VALUES ($1, $2, $3)`,
      [
        `Thread "${name.trim()}" was created`,
        session.user.id,
        params.id
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });

  } catch (error) {
    console.error('Error creating thread:', error);
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    );
  }
}

// Get threads for a group
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of the parent group
    const membership = await db.query(
      `SELECT 1 FROM group_members 
       WHERE group_id = $1 AND user_id = $2`,
      [params.id, session.user.id]
    );

    if (!membership.rows.length) {
      return NextResponse.json(
        { error: 'Group not found or user is not a member' },
        { status: 404 }
      );
    }

    // Get all threads for this group
    const threads = await db.query(
      `SELECT g.id, g.name, g.created_at,
              COUNT(DISTINCT m.id) as message_count,
              MAX(m.created_at) as last_message_at
       FROM groups g
       LEFT JOIN messages m ON m.group_id = g.id
       WHERE g.parent_group_id = $1
       GROUP BY g.id, g.name, g.created_at
       ORDER BY g.created_at DESC`,
      [params.id]
    );

    return NextResponse.json(threads.rows);

  } catch (error) {
    console.error('Error fetching threads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    );
  }
} 