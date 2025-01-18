import { createConversationalChain, formatChatHistory, initVectorStore } from './langchain';
import { SystemMessage } from '@langchain/core/messages';
import db from '@/lib/db';

interface Message {
  role: string;
  content: string;
}

/**
 * Processes a message and generates a response mimicking an offline user's style
 * @param query The incoming message to respond to
 * @param botId The ID of the AFK bot
 * @param userId The ID of the user sending the message
 * @param offlineUserId The ID of the offline user to mimic
 */
export async function processQuery(
  query: string,
  botId: string,
  userId: string,
  offlineUserId: string
) {
  const debugId = Math.random().toString(36).substring(7);
  console.log(`[RAG-${debugId}] Starting processQuery - Query: "${query}", UserId: ${userId}, OfflineUserId: ${offlineUserId}`);
  
  try {
    console.log(`[RAG-${debugId}] Fetching offline user's message history`);
    const offlineUserHistory = await db.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id, 
              m.receiver_id, m.group_id, m.deleted_at, m.conversation_context,
              prev.content as previous_message,
              CASE 
                WHEN m.group_id IS NOT NULL THEN g.name
                WHEN m.receiver_id IS NOT NULL THEN COALESCE(u.name, b.name)
              END as context_name,
              CASE 
                WHEN m.group_id IS NOT NULL THEN 'group'
                ELSE 'direct'
              END as message_type
       FROM messages m
       LEFT JOIN messages prev ON m.reply_to_message_id = prev.id
       LEFT JOIN groups g ON m.group_id = g.id
       LEFT JOIN users u ON m.receiver_id = u.id AND m.receiver_type = 'user'
       LEFT JOIN bot_users b ON m.receiver_id = b.id AND m.receiver_type = 'bot'
       WHERE m.sender_id = $1
         AND m.created_at > NOW() - INTERVAL '30 days'
         AND m.content IS NOT NULL
         AND m.deleted_at IS NULL
         AND m.is_automated_response = FALSE
         AND (m.message_type != 'auto_response' OR m.message_type IS NULL)
         AND (m.is_bot_generated = FALSE OR m.is_bot_generated IS NULL)
       ORDER BY m.created_at DESC
       LIMIT 100`,
      [offlineUserId]
    );
    console.log(`[RAG-${debugId}] Found ${offlineUserHistory.rows.length} messages from offline user`);

    // Log message contexts for debugging
    console.log(`[RAG-${debugId}] Message contexts:`, offlineUserHistory.rows.map(msg => ({
      type: msg.message_type,
      context: msg.context_name,
      contentPreview: msg.content.substring(0, 50)
    })));

    console.log(`[RAG-${debugId}] Initializing vector store`);
    const vectorStore = await initVectorStore();
    
    console.log(`[RAG-${debugId}] Searching for relevant response patterns`);
    const relevantDocs = await vectorStore.similaritySearch(query, 5, { 
      sender_id: offlineUserId
    });
    console.log(`[RAG-${debugId}] Found ${relevantDocs.length} relevant response patterns`);

    const relevantMessages = relevantDocs.map(doc => ({
      role: 'assistant',
      content: doc.pageContent,
      metadata: {
        ...doc.metadata,
        isOfflineUserMessage: true,
        context: doc.metadata.group_id ? 
          `in group ${doc.metadata.group_name}` : 
          `to ${doc.metadata.receiver_name}`
      }
    }));

    // Get direct conversation history between the two users for immediate context
    console.log(`[RAG-${debugId}] Fetching recent direct conversation between users`);
    const directHistory = await db.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id
       FROM messages m
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT 5`,
      [userId, offlineUserId]
    );

    const messages = directHistory.rows.reverse().map(msg => ({
      role: msg.sender_id === offlineUserId ? 'assistant' : 'user',
      content: msg.content,
      metadata: {
        id: msg.id,
        created_at: msg.created_at,
        sender_id: msg.sender_id
      }
    }));

    // Analyze user's communication style
    const styleAnalysis = await analyzeUserStyle(offlineUserHistory.rows);
    console.log(`[RAG-${debugId}] Analyzed user style:`, styleAnalysis);

    const chain = await createConversationalChain(vectorStore, botId);
    const directChatHistory = formatChatHistory(messages);
    const relevantChatHistory = formatChatHistory(relevantMessages);
    
    const systemMessage = new SystemMessage({
      content: `You are temporarily responding on behalf of an offline user. 
               Based on their communication style analysis:
               - They typically write messages around ${Math.round(styleAnalysis.averageLength)} characters long
               - They use emojis ${styleAnalysis.emojiFrequency > 0.5 ? 'frequently' : 'rarely'}
               - They use capital letters for emphasis ${styleAnalysis.capsFrequency > 0.3 ? 'often' : 'occasionally'}
               - They use exclamation marks ${styleAnalysis.exclamationFrequency > 0.5 ? 'frequently' : 'sparingly'}
               - They ${styleAnalysis.questionResponseRate > 0.7 ? 'usually' : 'sometimes'} respond to questions
               
               Formulate a response that matches these patterns while maintaining a natural conversation flow.`
    });

    console.log(`[RAG-${debugId}] Invoking LLM chain for AFK response`);
    const response = await chain.invoke({
      question: query,
      chat_history: [systemMessage, ...relevantChatHistory, ...directChatHistory]
    });

    return {
      answer: response.text,
      sourceDocuments: response.sourceDocuments,
      isAfkResponse: true,
      originalUser: offlineUserId
    };

  } catch (error) {
    console.error(`[RAG-${debugId}] Error in processQuery:`, error);
    throw error;
  }
}

/**
 * Analyzes a user's communication patterns and style based on their message history
 * @param messages Array of user messages with their context
 * @returns Object containing style characteristics
 */
async function analyzeUserStyle(messages: any[]) {
  // Calculate average message length
  const avgLength = messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length;
  
  // Analyze emoji usage
  const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojiCount = messages.reduce((sum, msg) => {
    const matches = msg.content.match(emojiPattern) || [];
    return sum + matches.length;
  }, 0);
  const emojiFrequency = emojiCount / messages.length;

  // Analyze capitalization patterns
  const capsMessages = messages.filter(msg => 
    msg.content.split(' ').some((word: string) => word === word.toUpperCase() && word.length > 1)
  ).length;
  const capsFrequency = capsMessages / messages.length;

  // Analyze punctuation patterns
  const exclamationCount = messages.reduce((sum, msg) => 
    sum + (msg.content.match(/!/g) || []).length, 0
  );
  const questionCount = messages.reduce((sum, msg) => 
    sum + (msg.content.match(/\?/g) || []).length, 0
  );

  // Analyze response patterns to questions
  const questionResponses = messages.filter(msg => 
    msg.previous_message?.includes('?')
  ).length;

  return {
    averageLength: avgLength,
    emojiFrequency,
    capsFrequency,
    exclamationFrequency: exclamationCount / messages.length,
    questionFrequency: questionCount / messages.length,
    questionResponseRate: questionResponses / messages.length,
    timestamp: new Date().toISOString()
  };
}