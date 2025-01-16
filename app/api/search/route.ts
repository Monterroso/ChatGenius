import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import db from '@/lib/db';

/**
 * Search API Route
 * 
 * Handles searching messages with various filters:
 * - Text search in message content using full-text search
 * - Filter by group
 * - Filter by sender (fromUser)
 * - Filter by receiver (toUser)
 * 
 * Returns messages ordered by creation date (newest first)
 * with sender information included
 */
export async function GET(req: NextRequest) {
  try {
    // Get the authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search parameters from URL
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('query');
    const groupId = searchParams.get('groupId');
    const fromUserId = searchParams.get('fromUserId');
    const toUserId = searchParams.get('toUserId');

    console.log('Search params:', { query, groupId, fromUserId, toUserId });

    // Build the query conditions
    const conditions = ['m.deleted_at IS NULL'];
    const values = [];
    let paramCount = 1;

    // Add content search if query exists
    if (query?.trim()) {
      conditions.push(`to_tsvector('english', m.content) @@ plainto_tsquery('english', $${paramCount})`);
      values.push(query.trim());
      paramCount++;
    }

    // Add group filter if groupId exists
    if (groupId) {
      conditions.push(`m.group_id = $${paramCount}`);
      values.push(groupId);
      paramCount++;
    }

    // Add user filters
    if (fromUserId) {
      conditions.push(`m.sender_id = $${paramCount} AND (m.sender_type = 'user' OR m.sender_type = 'bot')`);
      values.push(fromUserId);
      paramCount++;
    }

    if (toUserId) {
      conditions.push(`m.receiver_id = $${paramCount} AND (m.receiver_type = 'user' OR m.receiver_type = 'bot') AND m.group_id IS NULL`);
      values.push(toUserId);
      paramCount++;
    }

    // Ensure user can only search messages they have access to
    conditions.push(`(
      (m.sender_id = $${paramCount} AND m.sender_type = 'user')
      OR (m.receiver_id = $${paramCount} AND m.receiver_type = 'user')
      OR (m.receiver_id = $${paramCount} AND m.receiver_type = 'bot')
      ${groupId ? `OR m.group_id = $${paramCount + 1}` : ''}
    )`);
    values.push(session.user.id);
    values.push(session.user.id);
    if (groupId) {
      values.push(groupId);
    }

    // Build and execute the search query
    const searchQuery = `
      WITH search_results AS (
        SELECT m.*
        FROM messages m
        WHERE ${conditions.join(' AND ')}
        ORDER BY m.created_at DESC
        LIMIT 50
      )
      SELECT 
        sr.*,
        CASE sr.sender_type
          WHEN 'user' THEN json_build_object(
            'id', u_sender.id,
            'name', u_sender.name,
            'username', u_sender.username,
            'image', u_sender.image
          )
          WHEN 'bot' THEN json_build_object(
            'id', b_sender.id,
            'name', b_sender.name,
            'username', b_sender.name,
            'image', NULL
          )
        END as sender
      FROM search_results sr
      LEFT JOIN users u_sender ON sr.sender_id = u_sender.id AND sr.sender_type = 'user'
      LEFT JOIN bot_users b_sender ON sr.sender_id = b_sender.id AND sr.sender_type = 'bot'
      ORDER BY sr.created_at DESC
    `;

    console.log('Search query:', searchQuery);
    console.log('Query values:', values);

    const result = await db.query(searchQuery, values);
    console.log('Search results count:', result.rows.length);

    return NextResponse.json(result.rows);

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
} 