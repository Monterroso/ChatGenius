import db from '@/lib/db';

interface FeedbackData {
  botId: string;
  userId: string;
  conversationId: string;
  messageIndex: number;
  rating?: number;
  feedbackText?: string;
  responseTimeMs?: number;
  tokenCount?: number;
  metadata?: Record<string, any>;
}

export async function logFeedback(data: FeedbackData) {
  try {
    const result = await db.query(
      `INSERT INTO bot_feedback (
        bot_id, user_id, conversation_id, message_index,
        rating, feedback_text, response_time_ms, token_count, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        data.botId,
        data.userId,
        data.conversationId,
        data.messageIndex,
        data.rating || null,
        data.feedbackText || null,
        data.responseTimeMs || null,
        data.tokenCount || null,
        data.metadata || null
      ]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging feedback:', error);
    throw error;
  }
}

export async function getBotMetrics(botId: string) {
  try {
    const result = await db.query(
      'SELECT * FROM bot_feedback_metrics WHERE bot_id = $1',
      [botId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching bot metrics:', error);
    throw error;
  }
}

export async function getFeedbackHistory(
  botId: string,
  limit: number = 10,
  offset: number = 0
) {
  try {
    const result = await db.query(
      `SELECT 
        bf.*,
        u.name as user_name,
        bc.context->>'messages' as conversation_context
      FROM bot_feedback bf
      LEFT JOIN users u ON bf.user_id = u.id
      LEFT JOIN bot_conversations bc ON bf.conversation_id = bc.id
      WHERE bf.bot_id = $1
      ORDER BY bf.created_at DESC
      LIMIT $2 OFFSET $3`,
      [botId, limit, offset]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching feedback history:', error);
    throw error;
  }
}

export async function updateFeedback(
  feedbackId: string,
  updates: Partial<Omit<FeedbackData, 'botId' | 'userId' | 'conversationId' | 'messageIndex'>>
) {
  try {
    const setClause = Object.entries(updates)
      .map(([key, _], index) => `${snakeCaseKey(key)} = $${index + 2}`)
      .join(', ');

    const result = await db.query(
      `UPDATE bot_feedback
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [feedbackId, ...Object.values(updates)]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }
}

// Helper function to convert camelCase to snake_case
function snakeCaseKey(key: string): string {
  return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
} 