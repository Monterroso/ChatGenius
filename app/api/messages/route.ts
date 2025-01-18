/**
 * This file defines the API routes for fetching and posting messages.
 * It supports:
 * - GET /api/messages: Fetches recent messages from a group or a direct conversation.
 * - POST /api/messages: Creates a new message, stores its embedding, and optionally triggers
 *   an automated response if the recipient is away/offline. The automated response is processed
 *   asynchronously to ensure quick response times for the user.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authOptions } from "../auth/[...nextauth]/route"
import { calculateEffectiveStatus } from '@/lib/status';
import { processQuery } from '@/lib/ragSystem';
import { createEmbedding, storeMessageEmbedding } from '@/lib/embeddings';
import { findSimilarMessages } from '@/lib/embeddings';

/**
 * GET /api/messages
 * Fetches the most recent messages from either a given group ID or a direct message user ID.
 * - Requires the client to be authenticated (verified via session).
 * - Returns a maximum of 50 messages for performance reasons.
 */
export async function GET(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      console.log(`[${requestId}] ❌ Authentication failed: No valid session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId');

    if (!groupId && !userId) {
      console.log(`[${requestId}] ❌ Missing required parameters: No groupId or userId provided`);
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

    query += ' ORDER BY m.created_at DESC LIMIT 50';

    const { rows: messages } = await db.query(query, params);
    
    if (messages.length > 0) {
      console.log(`[${requestId}] Retrieved ${messages.length} messages`);
    }

    const orderedMessages = [...messages].reverse();
    return NextResponse.json(orderedMessages);
  } catch (error) {
    console.error(`[${requestId}] 🔥 Error fetching messages:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/messages
 * Creates a new message in either a group or a direct message channel.
 * The function:
 * 1. Stores the message in the database immediately
 * 2. Returns a success response to the client
 * 3. Asynchronously:
 *    - Generates and stores embeddings for the message with enhanced context
 *    - If recipient is away/offline, generates a contextually relevant automated response
 */
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      console.log(`[${requestId}] ❌ Authentication failed: No valid session found`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, groupId, receiverId, parentThreadId } = body;

    // Basic validations
    if (!content) {
      console.log(`[${requestId}] ❌ Validation failed: Content is missing`);
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (!groupId && !receiverId) {
      console.log(`[${requestId}] ❌ Validation failed: Neither groupId nor receiverId provided`);
      return NextResponse.json({ error: 'Either groupId or receiverId is required' }, { status: 400 });
    }
    if (groupId && receiverId) {
      console.log(`[${requestId}] ❌ Validation failed: Both groupId and receiverId provided`);
      return NextResponse.json({ error: 'Cannot specify both groupId and receiverId' }, { status: 400 });
    }

    // Determine receiver type and thread depth
    let receiverType: 'user' | 'bot' = 'user';
    let threadDepth = 0;

    if (receiverId) {
      const botCheck = await db.query('SELECT id FROM bot_users WHERE id = $1', [receiverId]);
      receiverType = botCheck.rows.length > 0 ? 'bot' : 'user';
    }

    if (parentThreadId) {
      const parentCheck = await db.query(
        'SELECT thread_depth FROM messages WHERE id = $1',
        [parentThreadId]
      );
      if (parentCheck.rows.length > 0) {
        threadDepth = parentCheck.rows[0].thread_depth + 1;
      }
    }

    // Insert the message
    const insertQuery = `
      INSERT INTO messages (
        content, 
        sender_id, 
        receiver_id, 
        group_id, 
        sender_type,
        receiver_type,
        parent_thread_id,
        thread_depth
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *`;
    
    const insertParams = [
      content,
      session.user.id,
      receiverId || null,
      groupId || null,
      'user',
      receiverType,
      parentThreadId || null,
      threadDepth
    ];

    const result = await db.query(insertQuery, insertParams);
    const message = result.rows[0];
    
    if (!message) {
      console.error(`[${requestId}] ❌ No message returned after insert`);
      throw new Error('No message returned after insert');
    }

    // Process message asynchronously
    (async () => {
      try {
        // Create and store embeddings with enhanced context
        const embedding = await createEmbedding(content, message.id);
        await storeMessageEmbedding(
          message.id,
          embedding,
          {
            sender_id: session.user.id,
            receiver_id: receiverId || groupId || '',
            timestamp: new Date(),
            group_id: groupId || undefined,
            sender_type: 'user',
            receiver_type: receiverType
          }
        );

        // Check if we need to generate an automated response
        if (receiverId && receiverType === 'user') {
          const statusResult = await db.query(
            `SELECT * FROM user_status WHERE user_id = $1`,
            [receiverId]
          );
          
          if (statusResult.rows.length > 0) {
            const status = statusResult.rows[0];
            const receiverStatus = calculateEffectiveStatus(status);
            const shouldGenerateResponse = receiverStatus.status === 'away' || receiverStatus.status === 'offline';

            if (shouldGenerateResponse) {
              console.log(`[${requestId}] Generating automated response for away/offline user`);
              
              // Get similar messages from the past using embeddings
              const similarMessages = await findSimilarMessages(embedding, 5, {
                sender_id: receiverId
              });

              // Fetch the actual messages
              const similarMessageIds = similarMessages.map(m => m.message_id);
              const { rows: relevantMessages } = await db.query(
                `SELECT content, created_at 
                 FROM messages 
                 WHERE id = ANY($1)
                 ORDER BY created_at DESC`,
                [similarMessageIds]
              );

              // Get recent messages for additional context
              const { rows: recentMessages } = await db.query(
                `SELECT content 
                 FROM messages 
                 WHERE sender_id = $1 
                   AND sender_type = 'user'
                   AND created_at > NOW() - INTERVAL '7 days'
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [receiverId]
              );

              // Combine contexts for better response generation
              const messageHistory = recentMessages.map(m => m.content).join('\n');
              const similarMessagesContext = relevantMessages
                .map(m => m.content)
                .join('\n');

              const contextPrompt = `
Based on the user's communication style from these similar messages:
${similarMessagesContext}

And their recent message history:
${messageHistory}

Please respond to this message in their style:
${content}`;
              
              const response = await processQuery(contextPrompt, receiverId, session.user.id);
              
              // Store the automated response
              const automatedResponse = await db.query(
                `INSERT INTO messages (
                  content, 
                  sender_id, 
                  receiver_id, 
                  sender_type,
                  receiver_type,
                  is_automated_response,
                  original_message_id,
                  parent_thread_id,
                  thread_depth
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
                RETURNING *`,
                [
                  response.answer,
                  receiverId,
                  session.user.id,
                  'user',
                  'user',
                  true,
                  message.id,
                  message.id,  // Set as reply to original message
                  threadDepth + 1
                ]
              );

              // Create embedding for automated response
              try {
                const responseEmbedding = await createEmbedding(response.answer, automatedResponse.rows[0].id);
                await storeMessageEmbedding(
                  automatedResponse.rows[0].id,
                  responseEmbedding,
                  {
                    sender_id: receiverId,
                    receiver_id: session.user.id,
                    timestamp: new Date(),
                    is_automated_response: true,
                    sender_type: 'user',
                    receiver_type: 'user'
                  }
                );
              } catch (embeddingError) {
                console.error(`[${requestId}] Error creating embedding for automated response:`, embeddingError);
              }
            }
          }
        }
      } catch (error) {
        console.error(`[${requestId}] Error in async processing:`, error);
      }
    })();

    return NextResponse.json(message);
  } catch (error) {
    console.error(`[${requestId}] Error in POST /api/messages:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 