/**
 * This file defines the API routes for fetching and posting messages.
 * It supports:
 * - GET /api/messages: Fetches recent messages from a group or a direct conversation.
 * - POST /api/messages: Creates a new message, stores its embedding, and optionally triggers
 *   an automated response if the recipient is away/offline.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authOptions } from "../auth/[...nextauth]/route"
import { calculateEffectiveStatus } from '@/lib/status';
import { processQuery } from '@/lib/ragSystem';
import { createEmbedding, storeMessageEmbedding } from '@/lib/embeddings';

/**
 * GET /api/messages
 * Fetches the most recent messages from either a given group ID or a direct message user ID.
 * - Requires the client to be authenticated (verified via session).
 * - Returns a maximum of 50 messages for performance reasons.
 */
export async function GET(request: Request) {
  try {
    // Check user session; if user is unauthorized, respond with 401.
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Retrieve query parameters from the request URL.
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId');

    // Ensure at least one filtering parameter is provided.
    if (!groupId && !userId) {
      return NextResponse.json({ error: 'Either groupId or userId is required' }, { status: 400 });
    }

    // Start building our SQL query dynamically based on provided parameters.
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

    // If a groupId is provided, filter by group. Otherwise, treat this as a user-to-user message history.
    if (groupId) {
      query += ` AND m.group_id = $${paramCount}`;
      params.push(groupId);
    } else if (userId) {
      // For direct messages, filter by either sender or receiver matching the given userId.
      query += ` AND (
        (m.sender_id = $${paramCount} AND m.receiver_id = $${paramCount + 1})
        OR 
        (m.sender_id = $${paramCount + 1} AND m.receiver_id = $${paramCount})
      )`;
      params.push(session.user.id, userId);
    }

    // Order the messages by creation date, limiting results to 50.
    query += ' ORDER BY m.created_at ASC LIMIT 50';

    // Execute the query with bound parameters.
    const { rows: messages } = await db.query(query, params);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/messages
 * Creates a new message in either a group or a direct message channel.
 * Once created, it also:
 * - Generates and stores embeddings for the new message.
 * - If the recipient is away/offline, generates and stores an automated response from the system bot.
 */
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7); // Generate unique ID for request tracking
  console.log(`[${requestId}] Starting POST /api/messages request`);
  
  try {
    // Check user session; if user is unauthorized, respond with 401.
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log(`[${requestId}] Authentication failed: No valid session found`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[${requestId}] Authentication successful for user: ${session.user.id}`);

    // Parse the request body to extract message details.
    const body = await request.json();
    const { content, groupId, receiverId } = body;
    console.log(`[${requestId}] Request parameters - groupId: ${groupId}, receiverId: ${receiverId}`);

    // Basic validations for the request parameters.
    if (!content) {
      console.log(`[${requestId}] Validation failed: Content is missing`);
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    if (!groupId && !receiverId) {
      console.log(`[${requestId}] Validation failed: Neither groupId nor receiverId provided`);
      return NextResponse.json({ error: 'Either groupId or receiverId is required' }, { status: 400 });
    }
    if (groupId && receiverId) {
      console.log(`[${requestId}] Validation failed: Both groupId and receiverId provided`);
      return NextResponse.json({ error: 'Cannot specify both groupId and receiverId' }, { status: 400 });
    }

    // Determine if the receiver is a user or a bot (for direct messages).
    let receiverType: 'user' | 'bot' = 'user';
    if (receiverId) {
      const botCheck = await db.query('SELECT id FROM bot_users WHERE id = $1', [receiverId]);
      console.log(`[${requestId}] Receiver type check - Is bot: ${botCheck.rows.length > 0}`);
      if (botCheck.rows.length > 0) {
        receiverType = 'bot';
      }
    }

    // Determine if the message should trigger an automated response based on the recipient's status.
    let shouldGenerateResponse = false;
    let receiverStatus = null;
    
    if (receiverId && receiverType === 'user') {
      console.log(`[${requestId}] Checking recipient status for user: ${receiverId}`);
      const statusResult = await db.query(
        `SELECT * FROM user_status WHERE user_id = $1`,
        [receiverId]
      );
      
      if (statusResult.rows.length > 0) {
        const status = statusResult.rows[0];
        receiverStatus = calculateEffectiveStatus(status);
        shouldGenerateResponse = receiverStatus.status === 'away' || receiverStatus.status === 'offline';
        console.log(`[${requestId}] Recipient status: ${receiverStatus.status}, Should generate response: ${shouldGenerateResponse}`);
      } else {
        console.log(`[${requestId}] No status found for recipient ${receiverId}`);
      }
    }

    // Insert the new message record.
    console.log(`[${requestId}] Attempting to insert new message`);
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

    const message = result.rows[0];
    console.log(`[${requestId}] Message inserted successfully with ID: ${message.id}`);

    // Create and store embeddings only if the message was successfully created.
    if (message) {
      try {
        console.log(`[${requestId}] Creating embedding for message: ${message.id}`);
        const embedding = await createEmbedding(content);
        console.log(`[${requestId}] Embedding created successfully`);
        
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
        console.log(`[${requestId}] Embedding stored successfully for message: ${message.id}`);
      } catch (embeddingError) {
        console.error(`[${requestId}] Error creating/storing embedding:`, embeddingError);
      }
    }

    // If the recipient is away/offline, generate and store an automated response from the system bot.
    if (shouldGenerateResponse) {
      console.log(`[${requestId}] Starting automated response generation`);
      try {
        // Gather recent messages from the recipient for context
        console.log(`[${requestId}] Fetching recent messages for context`);
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
        console.log(`[${requestId}] Found ${recentMessages.length} recent messages for context`);

        const messageHistory = recentMessages.map(m => m.content).join('\n');
        const contextPrompt = `Based on the user's recent messages:\n${messageHistory}\n\nRespond to: ${content}`;
        
        console.log(`[${requestId}] Processing query through RAG system`);
        const response = await processQuery(contextPrompt, receiverId, session.user.id);
        console.log(`[${requestId}] RAG system generated response successfully`);
        
        console.log(`[${requestId}] Fetching system bot ID`);
        const result = await db.query('SELECT get_system_bot_id()', []);
        const systemBotId = result.rows[0]?.get_system_bot_id as string;

        if (!systemBotId) {
          console.error(`[${requestId}] System bot not found`);
          return NextResponse.json(message);
        }
        console.log(`[${requestId}] System bot ID retrieved: ${systemBotId}`);
        
        console.log(`[${requestId}] Inserting bot response`);
        const botResponse = await db.query(
          `INSERT INTO messages (
            content, 
            sender_id, 
            receiver_id, 
            sender_type,
            receiver_type,
            is_automated_response,
            original_message_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING *`,
          [
            response.answer,
            systemBotId,
            session.user.id,
            'bot',
            'user',
            true,
            message.id
          ]
        );
        console.log(`[${requestId}] Bot response inserted successfully with ID: ${botResponse.rows[0]?.id}`);

        if (botResponse.rows[0]) {
          try {
            console.log(`[${requestId}] Creating embedding for bot response`);
            const responseEmbedding = await createEmbedding(response.answer);
            await storeMessageEmbedding(
              botResponse.rows[0].id,
              responseEmbedding,
              {
                sender_id: systemBotId,
                receiver_id: session.user.id,
                timestamp: new Date(),
                is_automated_response: true,
                sender_type: 'bot',
                receiver_type: 'user'
              }
            );
            console.log(`[${requestId}] Bot response embedding stored successfully`);

            console.log(`[${requestId}] Returning both original message and automated response`);
            return NextResponse.json({
              original: message,
              automated_response: botResponse.rows[0]
            });
          } catch (embeddingError) {
            console.error(`[${requestId}] Error creating embedding for bot response:`, embeddingError);
            // Return both messages even if embedding fails
            return NextResponse.json({
              original: message,
              automated_response: botResponse.rows[0]
            });
          }
        }

        console.log(`[${requestId}] Bot response creation failed, returning original message only`);
        return NextResponse.json(message);
      } catch (error) {
        console.error(`[${requestId}] Error generating automated response:`, error);
        return NextResponse.json(message);
      }
    }

    console.log(`[${requestId}] Request completed successfully - returning message`);
    return NextResponse.json(message);
  } catch (error) {
    console.error(`[${requestId}] Fatal error in POST /api/messages:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 