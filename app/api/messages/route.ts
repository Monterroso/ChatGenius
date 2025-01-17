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

/**
 * GET /api/messages
 * Fetches the most recent messages from either a given group ID or a direct message user ID.
 * - Requires the client to be authenticated (verified via session).
 * - Returns a maximum of 50 messages for performance reasons.
 */
export async function GET(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 🔍 GET /api/messages - Starting request`);
  
  try {
    const session = await getServerSession(authOptions);
    console.log(`[${requestId}] 🔐 Auth check - Session exists: ${!!session}`);

    if (!session) {
      console.log(`[${requestId}] ❌ Authentication failed: No valid session`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const userId = searchParams.get('userId');
    
    console.log(`[${requestId}] 📝 Request parameters - groupId: ${groupId}, userId: ${userId}, requestingUser: ${session.user.id}`);

    if (!groupId && !userId) {
      console.log(`[${requestId}] ❌ Missing required parameters: No groupId or userId provided`);
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

    if (groupId) {
      query += ` AND m.group_id = $${paramCount}`;
      params.push(groupId);
      console.log(`[${requestId}] 🔍 Querying for group messages - groupId: ${groupId}`);
    } else if (userId) {
      query += ` AND (
        (m.sender_id = $${paramCount} AND m.receiver_id = $${paramCount + 1})
        OR 
        (m.sender_id = $${paramCount + 1} AND m.receiver_id = $${paramCount})
      )`;
      params.push(session.user.id, userId);
      console.log(`[${requestId}] 🔍 Querying for direct messages between users: ${session.user.id} and ${userId}`);
    }

    // Order by newest messages first and limit to 50
    query += ' ORDER BY m.created_at DESC LIMIT 50';
    console.log(`[${requestId}] 📊 Executing query with params:`, params);

    const { rows: messages } = await db.query(query, params);
    console.log(`[${requestId}] ✅ Query successful - Retrieved ${messages.length} messages`);
    
    if (messages.length === 0) {
      console.log(`[${requestId}] ℹ️ No messages found for the given parameters`);
    } else {
      console.log(`[${requestId}] 📅 Message date range: ${new Date(messages[0].created_at)} to ${new Date(messages[messages.length - 1].created_at)}`);
    }

    // Reverse the messages array to display in chronological order (oldest to newest)
    const orderedMessages = [...messages].reverse();
    console.log(`[${requestId}] 🔄 Reversed message order for chronological display`);

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
 *    - Generates and stores embeddings for the message
 *    - If recipient is away/offline, generates and stores an automated response
 */
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] 📨 Starting POST /api/messages request`);
  
  try {
    const session = await getServerSession(authOptions);
    console.log(`[${requestId}] 🔐 Auth check - Session exists: ${!!session}, User: ${session?.user?.id}`);

    if (!session) {
      console.log(`[${requestId}] ❌ Authentication failed: No valid session found`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, groupId, receiverId } = body;
    console.log(`[${requestId}] 📝 Message details:
      - Content length: ${content?.length || 0}
      - GroupId: ${groupId || 'none'}
      - ReceiverId: ${receiverId || 'none'}
      - SenderId: ${session.user.id}
    `);

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

    // Determine receiver type
    let receiverType: 'user' | 'bot' = 'user';
    if (receiverId) {
      const botCheck = await db.query('SELECT id FROM bot_users WHERE id = $1', [receiverId]);
      const isBot = botCheck.rows.length > 0;
      console.log(`[${requestId}] 🤖 Receiver type check - Is bot: ${isBot}`);
      if (isBot) {
        receiverType = 'bot';
      }
    }

    console.log(`[${requestId}] 💾 Attempting to insert new message into database`);
    const insertQuery = `INSERT INTO messages (
        content, 
        sender_id, 
        receiver_id, 
        group_id, 
        sender_type,
        receiver_type
      ) VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *`;
    const insertParams = [
      content,
      session.user.id,
      receiverId || null,
      groupId || null,
      'user',
      receiverType
    ];
    
    console.log(`[${requestId}] 📝 Insert Query:`, insertQuery);
    console.log(`[${requestId}] 📝 Insert Parameters:`, insertParams);
    
    try {
      const result = await db.query(insertQuery, insertParams);
      console.log(`[${requestId}] ✅ Database insert successful. Rows affected:`, result.rowCount);
      
      const message = result.rows[0];
      if (!message) {
        console.error(`[${requestId}] ❌ No message returned after insert`);
        throw new Error('No message returned after insert');
      }
      
      console.log(`[${requestId}] ✅ Message stored successfully:
        - Message ID: ${message.id}
        - Created at: ${new Date(message.created_at)}
        - Content preview: ${content.substring(0, 50)}...
        - Sender ID: ${message.sender_id}
        - Receiver ID: ${message.receiver_id}
        - Group ID: ${message.group_id}
        - Sender Type: ${message.sender_type}
        - Receiver Type: ${message.receiver_type}
      `);

      // Process message asynchronously
      (async () => {
        try {
          console.log(`[${requestId}] 🔄 Starting async processing for message ${message.id}`);
          
          // Create and store embeddings
          console.log(`[${requestId}] 📊 Creating embedding for message ${message.id}`);
          const embedding = await createEmbedding(content);
          console.log(`[${requestId}] ✅ Embedding created successfully`);
          
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
          console.log(`[${requestId}] ✅ Embedding stored for message ${message.id}`);

          // Check if we need to generate an automated response
          if (receiverId && receiverType === 'user') {
            console.log(`[${requestId}] Checking recipient status for user: ${receiverId}`);
            const statusResult = await db.query(
              `SELECT * FROM user_status WHERE user_id = $1`,
              [receiverId]
            );
            
            if (statusResult.rows.length > 0) {
              const status = statusResult.rows[0];
              const receiverStatus = calculateEffectiveStatus(status);
              const shouldGenerateResponse = receiverStatus.status === 'away' || receiverStatus.status === 'offline';
              console.log(`[${requestId}] Recipient status: ${receiverStatus.status}, Should generate response: ${shouldGenerateResponse}`);

              if (shouldGenerateResponse) {
                console.log(`[${requestId}] Starting automated response generation`);
                try {
                  // Gather recent messages for context
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
                  
                  console.log(`[${requestId}] Inserting automated response as offline user`);
                  const automatedResponse = await db.query(
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
                      receiverId,
                      session.user.id,
                      'user',
                      'user',
                      true,
                      message.id
                    ]
                  );
                  console.log(`[${requestId}] Automated response inserted successfully with ID: ${automatedResponse.rows[0]?.id}`);

                  // Create embedding for automated response
                  try {
                    console.log(`[${requestId}] Creating embedding for automated response`);
                    const responseEmbedding = await createEmbedding(response.answer);
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
                    console.log(`[${requestId}] Automated response embedding stored successfully`);
                  } catch (embeddingError) {
                    console.error(`[${requestId}] Error creating embedding for automated response:`, embeddingError);
                  }
                } catch (error) {
                  console.error(`[${requestId}] Error generating automated response:`, error);
                }
              }
            }
          }
        } catch (error) {
          console.error(`[${requestId}] 🔥 Error in async processing:`, error);
        }
      })();

      console.log(`[${requestId}] ✅ Request completed successfully - returning message`);
      return NextResponse.json(message);
    } catch (error) {
      console.error(`[${requestId}] 🔥 Error in database insert:`, error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  } catch (error) {
    console.error(`[${requestId}] 🔥 Fatal error in POST /api/messages:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 