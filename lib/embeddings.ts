import { OpenAIEmbeddings } from '@langchain/openai';
import { OpenAI } from 'openai';
import db from './db';

// Initialize OpenAI client for content analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface HistoryMessage {
  content: string;
  created_at: Date;
  sender_id: string;
  receiver_id: string;
  group_id?: string;
}

interface DBMessage {
  id: string;
  content: string;
  created_at: Date;
  sender_id: string;
  receiver_id: string;
  group_id: string | null;
  parent_id: string | null;
  parent_content: string | null;
  parent_created_at: Date | null;
  thread_depth: number;
}

/**
 * Analyzes message content to extract semantic information
 * @param text - The message content to analyze
 * @returns Object containing semantic analysis results
 */
async function analyzeMessageContent(text: string): Promise<{
  sentiment: string;
  topics: string[];
  intent: string;
  semantic_context: Record<string, any>;
}> {
  const prompt = `Analyze the following message and provide:
1. Sentiment (positive, negative, or neutral)
2. Main topics (up to 3 key topics)
3. Message intent (question, statement, request, etc.)

Message: "${text}"

Respond in JSON format:
{
  "sentiment": "sentiment here",
  "topics": ["topic1", "topic2", "topic3"],
  "intent": "intent here"
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const analysis = JSON.parse(response.choices[0].message.content);
  
  return {
    sentiment: analysis.sentiment,
    topics: analysis.topics,
    intent: analysis.intent,
    semantic_context: {
      analysis_timestamp: new Date().toISOString(),
      analysis_model: "gpt-3.5-turbo",
      analysis_version: "1.0"
    }
  };
}

/**
 * Gets the conversation context for a message
 * @param messageId - The UUID of the message
 * @returns Object containing conversation context
 */
async function getConversationContext(messageId: string): Promise<Record<string, any>> {
  // Get message details
  const messageResult = await db.query<DBMessage>(
    `SELECT m.*, 
            p.id as parent_id, 
            p.content as parent_content,
            p.created_at as parent_created_at
     FROM messages m
     LEFT JOIN messages p ON m.parent_thread_id = p.id
     WHERE m.id = $1`,
    [messageId]
  );

  if (messageResult.rows.length === 0) {
    throw new Error('Message not found');
  }

  const message = messageResult.rows[0];

  // Get recent conversation history
  const historyResult = await db.query<HistoryMessage>(
    `SELECT m.content, m.created_at, m.sender_id, m.receiver_id, m.group_id
     FROM messages m
     WHERE (
       CASE 
         WHEN $1::uuid IS NOT NULL THEN m.group_id = $1::uuid
         ELSE (
           (m.sender_id = $2::uuid AND m.receiver_id = $3::uuid) OR
           (m.sender_id = $3::uuid AND m.receiver_id = $2::uuid)
         )
       END
     )
     AND m.created_at < $4::timestamp
     ORDER BY m.created_at DESC
     LIMIT 5`,
    [
      message.group_id || undefined,
      message.sender_id,
      message.receiver_id,
      message.created_at
    ]
  );

  return {
    thread_context: message.parent_id ? {
      parent_message_id: message.parent_id,
      parent_content: message.parent_content,
      parent_created_at: message.parent_created_at,
      thread_depth: message.thread_depth
    } : null,
    recent_history: historyResult.rows.map((m: HistoryMessage) => ({
      content: m.content,
      created_at: m.created_at,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      group_id: m.group_id
    })),
    conversation_type: message.group_id ? 'group' : 'direct',
    context_window: '5_messages'
  };
}

/**
 * Creates embeddings for a given text using OpenAI's text-embedding-3-small model
 * @param text - The text to create embeddings for
 * @param messageId - Optional message ID for including conversation context
 * @returns A Promise that resolves to the embedding vector
 */
export async function createEmbedding(
  text: string,
  messageId?: string
): Promise<number[]> {
  let contextualContent = text;

  // If messageId is provided, include conversation context
  if (messageId) {
    const conversationContext = await getConversationContext(messageId);
    const recentHistory = conversationContext.recent_history
      .map(m => m.content)
      .join('\n');
    
    contextualContent = `Previous messages:\n${recentHistory}\n\nCurrent message:\n${text}`;
  }

  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  
  const result = await embeddings.embedQuery(contextualContent);
  return result;
}

/**
 * Stores a message embedding in the database with enhanced metadata
 * @param messageId - The UUID of the message
 * @param embedding - The embedding vector
 * @param metadata - Additional metadata about the message
 * @returns A Promise that resolves when the embedding is stored
 */
export async function storeMessageEmbedding(
  messageId: string | { id: string },
  embedding: number[],
  metadata: {
    sender_id: string;
    receiver_id: string;
    timestamp: Date;
    group_id?: string;
    is_automated_response?: boolean;
    sender_type?: 'user' | 'bot';
    receiver_type?: 'user' | 'bot';
  }
): Promise<void> {
  const actualMessageId = typeof messageId === 'string' ? messageId : messageId.id;
  
  // Validate embedding array
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding: must be a non-empty array of numbers');
  }

  // Ensure all elements are numbers and format them properly
  const formattedEmbedding = embedding.map(num => {
    if (typeof num !== 'number' || isNaN(num)) {
      throw new Error('Invalid embedding: all elements must be valid numbers');
    }
    return num.toString();
  });
  
  // Format the embedding array as a PostgreSQL vector string with proper formatting
  const vectorString = `[${formattedEmbedding.join(',')}]`;
  
  // Get message content for analysis
  const messageResult = await db.query(
    'SELECT content FROM messages WHERE id = $1',
    [actualMessageId]
  );

  if (!messageResult.rows.length) {
    throw new Error('Message not found');
  }

  const messageContent = messageResult.rows[0].content;
  
  // Analyze message content
  const analysis = await analyzeMessageContent(messageContent);
  
  // Get conversation context
  const conversationContext = await getConversationContext(actualMessageId);
  
  try {
    // Store embedding with enhanced metadata
    await db.query(
      `INSERT INTO message_embeddings (message_id, embedding, metadata)
       VALUES ($1, $2::vector, $3)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        actualMessageId, 
        vectorString,
        {
          ...metadata,
          model_name: 'text-embedding-3-small',
          context_type: metadata.group_id ? 'group_message' : 'direct_message',
          embedding_version: '1.0',
          semantic_analysis: {
            sentiment: analysis.sentiment,
            topics: analysis.topics,
            intent: analysis.intent,
            ...analysis.semantic_context
          },
          conversation_context: conversationContext
        }
      ]
    );
  } catch (error: any) {
    console.error('Error storing embedding:', error);
    throw new Error(`Failed to store embedding: ${error.message}`);
  }

  // Update the message with conversation context
  await db.query(
    `UPDATE messages 
     SET conversation_context = $1
     WHERE id = $2`,
    [conversationContext, actualMessageId]
  );
}

/**
 * Finds similar messages using cosine similarity
 * @param embedding - The query embedding vector
 * @param limit - Maximum number of results to return
 * @param filter - Optional filter conditions (e.g., specific user's messages)
 * @returns A Promise that resolves to an array of similar messages with their similarity scores
 */
export async function findSimilarMessages(
  embedding: number[],
  limit: number = 5,
  filter?: { sender_id?: string; receiver_id?: string }
): Promise<Array<{ message_id: string; similarity: number }>> {
  // Validate embedding array
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('Invalid embedding: must be a non-empty array of numbers');
  }

  // Ensure all elements are numbers and format them properly
  const formattedEmbedding = embedding.map(num => {
    if (typeof num !== 'number' || isNaN(num)) {
      throw new Error('Invalid embedding: all elements must be valid numbers');
    }
    return num.toString();
  });
  
  // Format the embedding array as a PostgreSQL vector string
  const vectorString = `[${formattedEmbedding.join(',')}]`;

  let query = `
    SELECT 
      message_id,
      1 - (embedding <=> $1::vector) as similarity
    FROM message_embeddings
    WHERE 1=1
  `;
  
  const params: any[] = [vectorString];
  let paramCount = 2;
  
  if (filter?.sender_id) {
    query += ` AND metadata->>'sender_id' = $${paramCount}`;
    params.push(filter.sender_id);
    paramCount++;
  }
  
  if (filter?.receiver_id) {
    query += ` AND metadata->>'receiver_id' = $${paramCount}`;
    params.push(filter.receiver_id);
    paramCount++;
  }
  
  query += `
    ORDER BY similarity DESC
    LIMIT $${paramCount}
  `;
  params.push(limit);
  
  try {
    const result = await db.query(query, params);
    return result.rows;
  } catch (error: any) {
    console.error('Error finding similar messages:', error);
    throw new Error(`Failed to find similar messages: ${error.message}`);
  }
} 