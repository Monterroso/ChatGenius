import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authOptions } from "../auth/[...nextauth]/route"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId');

    // Require either groupId or userId parameter
    if (!groupId && !userId) {
      return NextResponse.json({ error: 'Either groupId or userId is required' }, { status: 400 });
    }

    let query = `
      SELECT 
        m.*,
        sender.name as sender_name,
        sender.username as sender_username,
        receiver.name as receiver_name,
        receiver.username as receiver_username
      FROM messages m
      JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN users receiver ON m.receiver_id = receiver.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 1;

    // Filter by group messages or direct messages
    if (groupId) {
      query += ` AND m.group_id = $${paramCount}`;
      params.push(groupId);
    } else if (userId) {
      query += ` AND (
        (m.sender_id = $${paramCount} AND m.receiver_id = $${paramCount + 1})
        OR 
        (m.sender_id = $${paramCount + 1} AND m.receiver_id = $${paramCount})
      )`;
      params.push(session.user.id, userId);
    }

    query += ' ORDER BY m.created_at ASC LIMIT 50';

    const { rows: messages } = await db.query(query, params);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('User ID from session:', session?.user?.id);
    console.log('User ID type:', typeof session?.user?.id);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, groupId, receiverId } = await request.json();
    console.log('Message data:', { content, groupId, receiverId, senderId: session.user.id });

    if (!content) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Check that either groupId or receiverId is provided, but not both
    if ((!groupId && !receiverId) || (groupId && receiverId)) {
      return NextResponse.json(
        { error: 'Either groupId or receiverId must be provided, but not both' }, 
        { status: 400 }
      );
    }

    try {
      const { rows: [message] } = await db.query(`
        INSERT INTO messages (content, sender_id, group_id, receiver_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [content, session.user.id, groupId || null, receiverId || null]);

      console.log('Inserted message:', message);
      return NextResponse.json(message);
    } catch (dbError) {
      console.error('Database error details:', dbError);
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Full error object:', error);
    return NextResponse.json({ error: 'Error creating message', details: error }, { status: 500 });
  }
} 