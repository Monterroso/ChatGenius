import { createConversationalChain, formatChatHistory, initVectorStore } from './langchain';
import { searchSimilarDocuments } from './vectorStore';
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
  try {
    // Get recent conversation history from messages table
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

    // Format messages for the conversation chain
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

        // Initialize conversation chain
    const vectorStore = await initVectorStore();
    const chain = await createConversationalChain(vectorStore, botId);

    // Format conversation history as AIMessage/HumanMessage
    const chatHistory = formatChatHistory(messages);

    // Get response from the LLM
    const response = await chain.invoke({
      question: query,
      chat_history: chatHistory
    });

    return {
      answer: response.text,
      sourceDocuments: response.sourceDocuments
    };
  } catch (error) {
    console.error('Error processing query:', error);
    throw error;
  }
}

export async function getConversationHistory(botId: string, userId: string) {
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

    return result.rows.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  } catch (error) {
    console.error('Error getting conversation history:', error);
    throw error;
  }
}