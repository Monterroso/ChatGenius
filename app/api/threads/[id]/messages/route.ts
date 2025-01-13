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

    const { content } = await req.json();
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Verify this is a thread and user is a member
    const threadCheck = await db.query(
      `SELECT g.id, g.parent_group_id 
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 
       AND g.parent_group_id IS NOT NULL 
       AND gm.user_id = $2`,
      [params.id, session.user.id]
    );

    if (!threadCheck.rows.length) {
      return NextResponse.json(
        { error: 'Thread not found or user is not a member' },
        { status: 404 }
      );
    }

    // Create the message
    const result = await db.query(
      `INSERT INTO messages (content, sender_id, group_id)
       VALUES ($1, $2, $3)
       RETURNING 
         id, 
         content, 
         created_at, 
         sender_id,
         group_id`,
      [content.trim(), session.user.id, params.id]
    );

    // Get sender details for the response
    const messageWithSender = await db.query(
      `SELECT 
         m.*,
         u.name as sender_name,
         u.username as sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    return NextResponse.json(messageWithSender.rows[0], { status: 201 });

  } catch (error) {
    console.error('Error creating thread message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify this is a thread and user is a member
    const threadCheck = await db.query(
      `SELECT g.id 
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE g.id = $1 
       AND g.parent_group_id IS NOT NULL 
       AND gm.user_id = $2`,
      [params.id, session.user.id]
    );

    if (!threadCheck.rows.length) {
      return NextResponse.json(
        { error: 'Thread not found or user is not a member' },
        { status: 404 }
      );
    }

    // Get messages with sender details
    const messages = await db.query(
      `SELECT 
         m.id,
         m.content,
         m.created_at,
         m.sender_id,
         u.name as sender_name,
         u.username as sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.group_id = $1
       AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [params.id]
    );

    return NextResponse.json(messages.rows);

  } catch (error) {
    console.error('Error fetching thread messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
} 