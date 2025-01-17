import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';
import logger from '@/lib/logger';

/**
 * GET /api/messages/[id]/thread
 * Fetches a message and all its replies in a threaded conversation.
 * Uses a recursive CTE to fetch the original message and all descendants.
 * Results are sorted by created_at for a chronological view of the conversation.
 * 
 * @param {string} id - The ID of the root message to fetch the thread for
 * @returns {object[]} Array of messages in the thread with sender details
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Math.random().toString(36).substring(7);
  logger.debug(`[${requestId}] 🔍 Starting GET /api/messages/${params.id}/thread`);

  try {
    // Validate session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      logger.api(401, `[${requestId}] Unauthorized thread fetch attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use a recursive CTE to fetch the thread
    const { rows: messages } = await db.query(
      `WITH RECURSIVE thread AS (
        -- Base case: get the original message
        SELECT 
          m.id,
          m.content,
          m.created_at,
          m.sender_id,
          m.receiver_id,
          m.group_id,
          m.reply_to_message_id,
          m.sender_type,
          m.receiver_type,
          u.name as sender_name,
          u.username as sender_username,
          1 as depth
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1

        UNION ALL

        -- Recursive case: get all replies
        SELECT 
          m.id,
          m.content,
          m.created_at,
          m.sender_id,
          m.receiver_id,
          m.group_id,
          m.reply_to_message_id,
          m.sender_type,
          m.receiver_type,
          u.name as sender_name,
          u.username as sender_username,
          t.depth + 1
        FROM messages m
        JOIN thread t ON m.reply_to_message_id = t.id
        JOIN users u ON m.sender_id = u.id
      )
      SELECT * FROM thread
      ORDER BY created_at ASC`,
      [params.id]
    );

    if (messages.length === 0) {
      logger.api(404, `[${requestId}] Thread or message not found: ${params.id}`);
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Verify user has access to this thread
    const rootMessage = messages[0];
    if (rootMessage.group_id) {
      // Check group membership
      const { rows: membership } = await db.query(
        `SELECT 1 FROM group_members 
         WHERE group_id = $1 AND user_id = $2`,
        [rootMessage.group_id, session.user.id]
      );
      
      if (membership.length === 0) {
        logger.api(403, `[${requestId}] User ${session.user.id} not authorized to view thread in group ${rootMessage.group_id}`);
        return NextResponse.json({ error: 'Not authorized to view this thread' }, { status: 403 });
      }
    } else {
      // For direct messages, verify user is either sender or receiver
      if (rootMessage.sender_id !== session.user.id && rootMessage.receiver_id !== session.user.id) {
        logger.api(403, `[${requestId}] User ${session.user.id} not authorized to view direct message thread`);
        return NextResponse.json({ error: 'Not authorized to view this thread' }, { status: 403 });
      }
    }

    logger.api(200, `[${requestId}] Thread fetched successfully with ${messages.length} messages`);
    return NextResponse.json(messages);

  } catch (error) {
    logger.error(`[${requestId}] Error fetching thread:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
} 