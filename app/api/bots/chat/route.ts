import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getBotInfo } from '@/middleware/botAuth';
import { processQuery } from '@/lib/ragSystem';
import { parseCommand } from '@/lib/commandParser';
import db from '@/lib/db';

/**
 * POST /api/bots/chat
 * Handles chat messages sent to bots. The function:
 * 1. Stores the user's message immediately
 * 2. Returns a success response to the client
 * 3. Processes the bot's response asynchronously
 * 4. Stores the bot's response in the database when ready
 */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botInfo = getBotInfo(req);
    if (!botInfo) {
      return NextResponse.json({ error: 'Bot information not found' }, { status: 400 });
    }

    const { message, isInitializing } = await req.json();

    // Store user's message
    const userMessageResult = await db.query(
      'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [message, session.user.id, botInfo.botId, 'user', 'bot']
    );

    // If we're initializing, don't process any messages
    if (isInitializing) {
      return NextResponse.json({ success: true });
    }

    // Process bot response asynchronously
    (async () => {
      try {
        let botResponse;
        
        // Check if message is a command
        if (message.startsWith('/')) {
          const commandResult = await parseCommand(message, botInfo.botId, session.user.id);
          botResponse = commandResult.response;
        } else {
          // Process message through RAG system
          const response = await processQuery(
            message,
            botInfo.botId,
            session.user.id
          );
          botResponse = response.answer;
        }

        // Store bot's response
        await db.query(
          'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type) VALUES ($1, $2, $3, $4, $5)',
          [botResponse, botInfo.botId, session.user.id, 'bot', 'user']
        );
      } catch (error) {
        console.error('Error processing bot response:', error);
        // Store error message as bot response
        await db.query(
          'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type, is_error) VALUES ($1, $2, $3, $4, $5, $6)',
          ['Sorry, I encountered an error processing your message.', botInfo.botId, session.user.id, 'bot', 'user', true]
        );
      }
    })();

    // Return success immediately after storing user message
    return NextResponse.json({ 
      success: true,
      message: userMessageResult.rows[0]
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 