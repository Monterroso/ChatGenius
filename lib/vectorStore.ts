import { embeddings, initVectorStore } from './langchain';
import db from '@/lib/db';

export async function addDocumentToVectorStore(content: string, metadata: any, botId: string) {
  try {
    const vectorStore = await initVectorStore();
    await vectorStore.addDocuments([{ pageContent: content, metadata: { ...metadata, botId } }]);

    // Store minimal metadata in PostgreSQL
    await db.query(
      `INSERT INTO bot_knowledge (bot_id, content, metadata) VALUES ($1, $2, $3)`,
      [botId, content, metadata]
    );

    return true;
  } catch (error) {
    console.error('Error adding document to vector store:', error);
    throw error;
  }
}

export async function searchSimilarDocuments(query: string, botId: string, limit: number = 5) {
  try {
    const vectorStore = await initVectorStore();
    const results = await vectorStore.similaritySearch(query, limit, { botId });
    return results;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
}

export async function deleteDocumentsForBot(botId: string) {
  try {
    const vectorStore = await initVectorStore();
    await vectorStore.delete({ filter: { botId } });
    
    // Clean up PostgreSQL metadata
    await db.query('DELETE FROM bot_knowledge WHERE bot_id = $1', [botId]);
    
    return true;
  } catch (error) {
    console.error('Error deleting documents:', error);
    throw error;
  }
} 