import { createConversationalChain, formatChatHistory, initVectorStore, embeddings } from './langchain';
import { searchBotKnowledge } from './botKnowledge';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import db from '@/lib/db';

interface Message {
  role: string;
  content: string;
}

export async function processQuery(
  query: string,
  botId: string,
  userId: string
) {
  const debugId = Math.random().toString(36).substring(7);
  console.log(`[RAG-${debugId}] Starting processQuery - Query: "${query}", BotId: ${botId}, UserId: ${userId}`);
  
  try {
    console.log(`[RAG-${debugId}] Fetching recent direct conversation history`);
    // Get recent direct conversation history between user and this bot
    const result = await db.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id, m.receiver_id, m.group_id, m.deleted_at,
        CASE 
          WHEN m.sender_id = $1 THEN 'assistant'
          ELSE 'user'
        END as role
       FROM messages m
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT 10`,
      [botId, userId]
    );
    console.log(`[RAG-${debugId}] Found ${result.rows.length} direct conversation messages`);

    console.log(`[RAG-${debugId}] Fetching user's message history across all conversations`);
    // Get user's message history across all conversations
    const userHistoryResult = await db.query(
      `SELECT 
        m.id, 
        m.content, 
        m.created_at, 
        m.sender_id, 
        m.receiver_id, 
        m.receiver_type,
        m.group_id, 
        m.deleted_at,
        CASE 
          WHEN m.receiver_type = 'bot' THEN b.name
          WHEN m.receiver_type = 'user' THEN u.name
          WHEN m.group_id IS NOT NULL THEN g.name
          ELSE NULL
        END as receiver_name,
        CASE
          WHEN m.group_id IS NOT NULL THEN 'group'
          ELSE m.receiver_type
        END as context_type
       FROM messages m
       LEFT JOIN bot_users b ON m.receiver_id = b.id AND m.receiver_type = 'bot'
       LEFT JOIN users u ON m.receiver_id = u.id AND m.receiver_type = 'user'
       LEFT JOIN groups g ON m.group_id = g.id
       WHERE m.sender_id = $1
         AND (m.receiver_id != $2 OR m.group_id IS NOT NULL)
         AND m.created_at > NOW() - INTERVAL '7 days'
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [userId, botId]
    );
    console.log(`[RAG-${debugId}] Found ${userHistoryResult.rows.length} historical messages`);

    console.log(`[RAG-${debugId}] Initializing vector store`);
    // Initialize vector store
    const vectorStore = await initVectorStore();
    console.log(`[RAG-${debugId}] Vector store initialized successfully`);
    
    console.log(`[RAG-${debugId}] Searching for relevant messages`);
    // Search for relevant messages using vector store
    const relevantDocs = await vectorStore.similaritySearch(query, 5, { 
      isUserMessage: true,
      userId: userId
    });
    console.log(`[RAG-${debugId}] Found ${relevantDocs.length} relevant documents`);
    console.log(`[RAG-${debugId}] Relevant docs:`, relevantDocs.map(doc => ({
      content: doc.pageContent.substring(0, 50) + '...',
      metadata: doc.metadata
    })));

    // Format relevant messages
    const relevantMessages = relevantDocs.map(doc => ({
      role: 'user',
      content: doc.pageContent,
      metadata: doc.metadata
    }));

    console.log(`[RAG-${debugId}] Formatting conversation messages`);
    // Format current conversation messages
    const messages = result.rows.reverse().map(msg => ({
      role: msg.role,
      content: msg.content,
      metadata: {
        id: msg.id,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        group_id: msg.group_id,
        deleted_at: msg.deleted_at
      }
    }));

    console.log(`[RAG-${debugId}] Creating conversation chain`);
    // Initialize conversation chain
    const chain = await createConversationalChain(vectorStore, botId);
    console.log(`[RAG-${debugId}] Conversation chain created successfully`);

    // Format both direct conversation history and relevant messages as AIMessage/HumanMessage
    console.log(`[RAG-${debugId}] Formatting chat histories`);
    const directChatHistory = formatChatHistory(messages);
    const relevantChatHistory = formatChatHistory(relevantMessages);
    
    // Combine histories, putting relevant messages first (as context) followed by direct conversation
    const combinedHistory = [...relevantChatHistory, ...directChatHistory];
    console.log(`[RAG-${debugId}] Combined history length: ${combinedHistory.length}`);

    console.log(`[RAG-${debugId}] Invoking LLM chain`);
    // Get response from the LLM
    const response = await chain.invoke({
      question: query,
      chat_history: combinedHistory
    });
    console.log(`[RAG-${debugId}] LLM response received successfully`);
    console.log(`[RAG-${debugId}] Response text: "${response.text.substring(0, 100)}..."`);

    return {
      answer: response.text,
      sourceDocuments: response.sourceDocuments
    };
  } catch (error) {
    console.error(`[RAG-${debugId}] Error in processQuery:`, error);
    throw error;
  }
}

// Helper function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function getConversationHistory(botId: string, userId: string) {
  const debugId = Math.random().toString(36).substring(7);
  console.log(`[RAG-${debugId}] Getting conversation history - BotId: ${botId}, UserId: ${userId}`);
  
  try {
    const result = await db.query(
      `SELECT m.*, 
        CASE 
          WHEN m.sender_id = $1 THEN 'assistant'
          ELSE 'user'
        END as role
       FROM messages m
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [botId, userId]
    );
    console.log(`[RAG-${debugId}] Found ${result.rows.length} conversation history messages`);

    const messages = result.rows.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    return messages;
  } catch (error) {
    console.error(`[RAG-${debugId}] Error getting conversation history:`, error);
    throw error;
  }
}