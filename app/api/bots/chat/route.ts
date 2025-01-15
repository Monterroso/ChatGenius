import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getBotInfo } from '@/middleware/botAuth';
import { processQuery } from '@/lib/ragSystem';
import { parseCommand } from '@/lib/commandParser';
import db from '@/lib/db';

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
    await db.query(
      'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type) VALUES ($1, $2, $3, $4, $5)',
      [message, session.user.id, botInfo.botId, 'user', 'bot']
    );

    // If we're initializing, don't process any messages
    if (isInitializing) {
      return NextResponse.json({ success: true });
    }

    // Check if message is a command
    if (message.startsWith('/')) {
      const commandResult = await parseCommand(message, botInfo.botId, session.user.id);
      
      // Store bot's response
      await db.query(
        'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type) VALUES ($1, $2, $3, $4, $5)',
        [commandResult.response, botInfo.botId, session.user.id, 'bot', 'user']
      );
      
      return NextResponse.json({
        answer: commandResult.response,
        success: commandResult.success,
        type: 'command'
      });
    }

    // Process message through RAG system
    const response = await processQuery(
      message,
      botInfo.botId,
      session.user.id
    );

    // Store bot's response
    await db.query(
      'INSERT INTO messages (content, sender_id, receiver_id, sender_type, receiver_type) VALUES ($1, $2, $3, $4, $5)',
      [response.answer, botInfo.botId, session.user.id, 'bot', 'user']
    );

    return NextResponse.json({
      answer: response.answer,
      sourceDocuments: response.sourceDocuments
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 