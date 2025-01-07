import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../../../lib/db';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = params.id;

    const { rows: messages } = await db.query(`
      SELECT m.*, u.name as sender_name, u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [groupId]);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content } = await request.json();
    const groupId = params.id;

    const { rows: [message] } = await db.query(`
      INSERT INTO messages (content, sender_id, group_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [content, session.user.id, groupId]);

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Error creating message' }, { status: 500 });
  }
} 