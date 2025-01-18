import db from '@/lib/db';
import { DBMessage } from '@/types/db';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { chunk } from 'lodash';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BATCH_SIZE = 100; // Process messages in batches of 100
const CONCURRENT_REQUESTS = 5; // Number of concurrent embedding requests
const RATE_LIMIT_DELAY = 1000; // 1 second delay between batches to avoid rate limits
const CONTEXT_WINDOW = 2; // Number of messages before and after to include as context

/**
 * Fetches context for a message including surrounding messages and user details
 * @param message The message to fetch context for
 * @returns Formatted context string including user details and surrounding messages
 */
async function getMessageContext(message: DBMessage): Promise<string> {
  // Get user details with error handling
  let senderDetails = { name: 'Unknown', username: 'unknown' };
  let receiverDetails = null;
  let groupDetails = null;

  try {
    const senderResult = await db.query('SELECT username, name FROM users WHERE id = $1::uuid', [message.sender_id]);
    if (senderResult.rows.length > 0) {
      senderDetails = senderResult.rows[0];
    }

    if (message.receiver_id) {
      const receiverResult = await db.query('SELECT username, name FROM users WHERE id = $1::uuid', [message.receiver_id]);
      if (receiverResult.rows.length > 0) {
        receiverDetails = receiverResult.rows[0];
      }
    }

    if (message.group_id) {
      const groupResult = await db.query('SELECT name FROM groups WHERE id = $1::uuid', [message.group_id]);
      if (groupResult.rows.length > 0) {
        groupDetails = groupResult.rows[0];
      }
    }
  } catch (error) {
    console.error('Error fetching user/group details:', error);
  }

  // Get surrounding messages
  const surroundingMessages = await db.query(
    `SELECT m.content, m.created_at, u.username, u.name
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE 
       CASE 
         WHEN $1::uuid IS NOT NULL THEN m.group_id = $1::uuid
         WHEN $2::uuid IS NOT NULL THEN 
           (m.sender_id = $3::uuid AND m.receiver_id = $2::uuid) OR
           (m.sender_id = $2::uuid AND m.receiver_id = $3::uuid)
       END
       AND m.created_at BETWEEN 
         $4::timestamp - interval '1 hour'
         AND $4::timestamp + interval '1 hour'
       AND m.id != $5::uuid
     ORDER BY m.created_at
     LIMIT ${CONTEXT_WINDOW * 2 + 1}`,
    [
      message.group_id,
      message.receiver_id,
      message.sender_id,
      message.created_at,
      message.id
    ]
  );

  // Format the context string with safe fallbacks
  const contextParts = [
    `Time: ${new Date(message.created_at).toISOString()}`,
    `Sender: ${senderDetails.name || senderDetails.username}`,
    receiverDetails ? `Receiver: ${receiverDetails.name || receiverDetails.username}` : null,
    groupDetails ? `Group: ${groupDetails.name}` : null,
    '\nMessage:',
    message.content
  ].filter(Boolean);

  return contextParts.join('\n');
}

/**
 * Converts an array of floats to the '[1.23,4.56,...]' format expected by pgvector.
 * @param embedding - Array of numbers representing the embedding
 * @returns A string formatted as '[num1,num2,num3,...]'
 */
function convertArrayToVectorString(embedding: number[]): string {
  // Join the floats into a comma-separated string inside square brackets
  return `[${embedding.join(',')}]`;
}

/**
 * Generates an embedding for a single message using OpenAI's API
 * @param message The message to generate an embedding for
 * @returns The embedding vector or null if generation failed
 */
async function generateEmbedding(message: DBMessage): Promise<number[] | null> {
  try {
    const contextualContent = await getMessageContext(message);
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: contextualContent,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Failed to generate embedding for message ${message.id}:`, error);
    return null;
  }
}

/**
 * Process a batch of messages to generate and store their embeddings
 * @param messages Batch of messages to process
 * @returns Number of successfully processed messages
 */
async function processBatch(messages: DBMessage[]): Promise<number> {
  let successCount = 0;

  // Process messages concurrently in smaller chunks
  const chunks = chunk(messages, CONCURRENT_REQUESTS);
  
  for (const batchChunk of chunks) {
    const embeddings = await Promise.all(
      batchChunk.map(async (message) => {
        const embedding = await generateEmbedding(message);
        
        // Get surrounding message IDs for metadata
        const surroundingIds = await db.query(
          `SELECT id, created_at
           FROM messages
           WHERE 
             CASE 
               WHEN $1::uuid IS NOT NULL THEN group_id = $1::uuid
               WHEN $2::uuid IS NOT NULL THEN 
                 (sender_id = $3::uuid AND receiver_id = $2::uuid) OR
                 (sender_id = $2::uuid AND receiver_id = $3::uuid)
             END
             AND created_at BETWEEN 
               $4::timestamp - interval '1 hour'
               AND $4::timestamp + interval '1 hour'
             AND id != $5::uuid
           ORDER BY created_at
           LIMIT ${CONTEXT_WINDOW * 2 + 1}`,
          [
            message.group_id,
            message.receiver_id,
            message.sender_id,
            message.created_at,
            message.id
          ]
        );

        return { 
          message, 
          embedding,
          context_messages: surroundingIds.rows.map(row => ({
            id: row.id,
            created_at: row.created_at
          }))
        };
      })
    );

    // Store successful embeddings in the database
    for (const { message, embedding, context_messages } of embeddings) {
      if (embedding) {
        try {
          // Convert array of floats to the pgvector-required format
          const vectorString = convertArrayToVectorString(embedding);

          await db.query(
            `INSERT INTO message_embeddings (message_id, embedding, metadata) 
             VALUES ($1, $2::vector(1536), $3)
             ON CONFLICT (message_id) DO NOTHING`,
            [
              message.id,
              vectorString,
              {
                model_name: 'text-embedding-ada-002',
                context_type: message.group_id ? 'group_message' : 'direct_message',
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                group_id: message.group_id,
                created_at: message.created_at,
                context_messages: context_messages,
                embedding_version: '1.0',
                context_window_hours: 1
              }
            ]
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to store embedding for message ${message.id}:`, error);
        }
      }
    }

    // Rate limiting delay between chunks
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return successCount;
}

/**
 * Main function to backfill embeddings for all existing messages
 */
async function backfillEmbeddings() {
  try {
    // Get total message count
    const countResult = await db.query('SELECT COUNT(*) FROM messages', []);
    const totalMessages = parseInt(countResult.rows[0].count);
    
    console.log(`Starting backfill for ${totalMessages} messages`);
    let processedCount = 0;

    // Process messages in batches
    while (true) {
      const result = await db.query(
        `SELECT m.* FROM messages m 
         LEFT JOIN message_embeddings e ON m.id = e.message_id 
         WHERE e.id IS NULL 
         ORDER BY m.created_at ASC 
         LIMIT $1`,
        [BATCH_SIZE]
      );

      if (result.rows.length === 0) break;

      const successCount = await processBatch(result.rows);
      processedCount += result.rows.length;
      
      console.log(`Processed ${processedCount}/${totalMessages} messages. ${successCount} embeddings generated in this batch.`);
    }

    console.log('Backfill complete!');
  } catch (error) {
    console.error('Error during backfill:', error);
    process.exit(1);
  }
}

// Run the backfill if this script is executed directly
if (require.main === module) {
  backfillEmbeddings()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
} 