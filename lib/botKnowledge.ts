import { embeddings, initVectorStore } from './langchain';
import db from '@/lib/db';
import { Document } from '@langchain/core/documents';

/**
 * Manages bot knowledge base including vector storage and metadata
 * This is a high-level API for bot-specific document operations
 * that uses the PostgreSQLVectorStore under the hood
 */

/**
 * Adds a document to the bot's knowledge base
 * @param content - The content to store
 * @param metadata - Additional metadata about the content
 * @param botId - The ID of the bot this document belongs to
 * @returns True if successful
 */
export async function addBotKnowledge(content: string, metadata: any, botId: string) {
  try {
    const vectorStore = await initVectorStore();
    const doc = new Document({
      pageContent: content,
      metadata: { ...metadata, botId }
    });
    await vectorStore.addDocuments([doc]);

    // Store minimal metadata in PostgreSQL for tracking
    await db.query(
      `INSERT INTO bot_knowledge (bot_id, content, metadata) VALUES ($1, $2, $3)`,
      [botId, content, metadata]
    );

    return true;
  } catch (error) {
    console.error('Error adding bot knowledge:', error);
    throw error;
  }
}

/**
 * Searches for relevant knowledge in the bot's knowledge base
 * @param query - The search query
 * @param botId - The ID of the bot to search knowledge for
 * @param limit - Maximum number of results to return
 * @returns Array of relevant documents with their content and metadata
 */
export async function searchBotKnowledge(query: string, botId: string, limit: number = 5) {
  try {
    const vectorStore = await initVectorStore();
    const results = await vectorStore.similaritySearch(query, limit, { botId });
    return results;
  } catch (error) {
    console.error('Error searching bot knowledge:', error);
    throw error;
  }
}

/**
 * Deletes all knowledge for a specific bot
 * @param botId - The ID of the bot whose knowledge should be deleted
 * @returns True if successful
 */
export async function deleteBotKnowledge(botId: string) {
  try {
    // Clean up metadata from bot_knowledge table
    await db.query('DELETE FROM bot_knowledge WHERE bot_id = $1', [botId]);
    return true;
  } catch (error) {
    console.error('Error deleting bot knowledge:', error);
    throw error;
  }
}

/**
 * Lists all knowledge entries for a specific bot
 * @param botId - The ID of the bot
 * @returns Array of knowledge entries with their metadata
 */
export async function listBotKnowledge(botId: string) {
  try {
    const result = await db.query(
      'SELECT * FROM bot_knowledge WHERE bot_id = $1 ORDER BY created_at DESC',
      [botId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error listing bot knowledge:', error);
    throw error;
  }
} 