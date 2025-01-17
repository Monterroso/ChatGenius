import { OpenAIEmbeddings } from '@langchain/openai';
import db from './db';

/**
 * Creates embeddings for a given text using OpenAI's text-embedding-3-small model
 * @param text - The text to create embeddings for
 * @returns A Promise that resolves to the embedding vector
 */
export async function createEmbedding(text: string): Promise<number[]> {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  
  const result = await embeddings.embedQuery(text);
  return result;
}

/**
 * Stores a message embedding in the database
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
  // Handle case where messageId is an object containing id
  const actualMessageId = typeof messageId === 'string' ? messageId : messageId.id;
  
  // Format the embedding array as a PostgreSQL vector string
  const vectorString = `[${embedding.join(',')}]`;
  
  await db.query(
    `INSERT INTO message_embeddings (message_id, embedding, metadata)
     VALUES ($1, $2::vector, $3)
     ON CONFLICT (message_id) DO NOTHING`,
    [
      actualMessageId, 
      vectorString,
      {
        model_name: 'text-embedding-3-small',
        context_type: metadata.group_id ? 'group_message' : 'direct_message',
        sender_id: metadata.sender_id,
        receiver_id: metadata.receiver_id,
        group_id: metadata.group_id,
        created_at: metadata.timestamp,
        is_automated_response: metadata.is_automated_response || false,
        embedding_version: '1.0'
      }
    ]
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
  let query = `
    SELECT 
      message_id,
      1 - (embedding <=> $1::vector) as similarity
    FROM message_embeddings
    WHERE 1=1
  `;
  
  const params: any[] = [embedding];
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
  
  const result = await db.query(query, params);
  return result.rows;
} 