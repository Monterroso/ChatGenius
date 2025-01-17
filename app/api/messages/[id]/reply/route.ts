import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import logger from '@/lib/logger';

/**
 * POST /api/messages/[id]/reply
 * Creates a new message as a reply to an existing message, establishing a thread.
 * The reply will inherit the context (group_id or receiver_id) from the original message.
 * 
 * @param {string} id - The ID of the message being replied to (from URL parameter)
 * @param {object} body - Request body containing the reply content
 * @returns {object} The newly created reply message with sender details
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Math.random().toString(36).substring(7);
  logger.debug(`[${requestId}] 📨 Starting POST /api/messages/${params.id}/reply`);

  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.api(401, `[${requestId}] Unauthorized reply attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      logger.api(400, `[${requestId}] Missing content in reply`);
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify the original message exists and get its context
    const { rows: [originalMessage] } = await db.query(
      `SELECT 
        id,
        group_id,
        receiver_id,
        receiver_type,
        sender_id
      FROM messages 
      WHERE id = $1`,
      [params.id]
    );

    if (!originalMessage) {
      logger.api(404, `[${requestId}] Original message not found: ${params.id}`);
      return NextResponse.json({ error: 'Original message not found' }, { status: 404 });
    }

    logger.debug(`[${requestId}] Creating reply to message ${params.id}`);

    // Create the reply message with the same context as the original
    const { rows: [reply] } = await db.query(
      `INSERT INTO messages (
        content,
        sender_id,
        receiver_id,
        group_id,
        sender_type,
        receiver_type,
        reply_to_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        content.trim(),
        session.user.id,
        originalMessage.receiver_id,
        originalMessage.group_id,
        'user',
        originalMessage.receiver_type,
        originalMessage.id
      ]
    );

    // Get sender details for the response
    const { rows: [replyWithSender] } = await db.query(
      `SELECT 
        m.*,
        u.name as sender_name,
        u.username as sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = $1`,
      [reply.id]
    );

    logger.api(201, `[${requestId}] Reply created successfully: ${reply.id}`);
    return NextResponse.json(replyWithSender, { status: 201 });

  } catch (error) {
    logger.error(`[${requestId}] Error creating reply:`, error);
    return NextResponse.json(
      { error: 'Failed to create reply' },
      { status: 500 }
    );
  }
} 