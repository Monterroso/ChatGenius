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
        CASE 
          WHEN m.sender_type = 'user' THEN sender_user.name
          WHEN m.sender_type = 'bot' THEN sender_bot.name
        END as sender_name,
        CASE 
          WHEN m.sender_type = 'user' THEN sender_user.username
          WHEN m.sender_type = 'bot' THEN sender_bot.name
        END as sender_username,
        CASE 
          WHEN m.receiver_type = 'user' THEN receiver_user.name
          WHEN m.receiver_type = 'bot' THEN receiver_bot.name
        END as receiver_name,
        CASE 
          WHEN m.receiver_type = 'user' THEN receiver_user.username
          WHEN m.receiver_type = 'bot' THEN receiver_bot.name
        END as receiver_username
      FROM messages m
      LEFT JOIN users sender_user ON m.sender_id = sender_user.id AND m.sender_type = 'user'
      LEFT JOIN bot_users sender_bot ON m.sender_id = sender_bot.id AND m.sender_type = 'bot'
      LEFT JOIN users receiver_user ON m.receiver_id = receiver_user.id AND m.receiver_type = 'user'
      LEFT JOIN bot_users receiver_bot ON m.receiver_id = receiver_bot.id AND m.receiver_type = 'bot'
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, groupId, receiverId } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!groupId && !receiverId) {
      return NextResponse.json({ error: 'Either groupId or receiverId is required' }, { status: 400 });
    }

    // Ensure receiverId is null when sending to a group
    if (groupId && receiverId) {
      return NextResponse.json({ error: 'Cannot specify both groupId and receiverId' }, { status: 400 });
    }

    // Get receiver type (bot or user) only for direct messages
    let receiverType = 'user';
    if (receiverId) {
      const botCheck = await db.query('SELECT id FROM bot_users WHERE id = $1', [receiverId]);
      if (botCheck.rows.length > 0) {
        receiverType = 'bot';
      }
    }

    const result = await db.query(
      `INSERT INTO messages (
        content, 
        sender_id, 
        receiver_id, 
        group_id, 
        sender_type,
        receiver_type
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`,
      [
        content,
        session.user.id,
        receiverId || null,
        groupId || null,
        'user',
        receiverType
      ]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 