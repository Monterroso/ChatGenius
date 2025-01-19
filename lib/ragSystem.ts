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
 * @param contextMessages Array of relevant messages with metadata for context
 */
export async function processQuery(
  query: string,
  botId: string,
  userId: string,
  offlineUserId: string,
  contextMessages: Array<{ content: string; metadata: any }> = []
) {
  const debugId = Math.random().toString(36).substring(7);
  console.log(`[RAG-${debugId}] ====== Starting processQuery ======`);
  console.log(`[RAG-${debugId}] Input Parameters:`);
  console.log(`[RAG-${debugId}] - Query: "${query}"`);
  console.log(`[RAG-${debugId}] - BotId: ${botId}`);
  console.log(`[RAG-${debugId}] - UserId: ${userId}`);
  console.log(`[RAG-${debugId}] - OfflineUserId: ${offlineUserId}`);
  console.log(`[RAG-${debugId}] - Context Messages Count: ${contextMessages.length}`);
  
  try {
    // Log context messages details
    console.log(`[RAG-${debugId}] Context Messages Details:`);
    contextMessages.forEach((msg, index) => {
      console.log(`[RAG-${debugId}] Message ${index + 1}:`);
      console.log(`[RAG-${debugId}] - Content: "${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}"`);
      console.log(`[RAG-${debugId}] - Metadata:`, msg.metadata);
    });
    
    // Initialize vector store with context messages if provided
    console.log(`[RAG-${debugId}] Initializing vector store...`);
    const vectorStore = await initVectorStore();
    console.log(`[RAG-${debugId}] Vector store initialized successfully`);
    
    // Convert and log relevant messages
    const relevantMessages = contextMessages.map(msg => ({
      role: 'assistant',
      content: msg.content,
      metadata: {
        ...msg.metadata,
        isOfflineUserMessage: msg.metadata.sender_id === offlineUserId
      }
    }));
    console.log(`[RAG-${debugId}] Converted ${relevantMessages.length} relevant messages`);

    // Get and log direct conversation history
    console.log(`[RAG-${debugId}] Fetching direct conversation history...`);
    const directHistory = await db.query(
      `SELECT m.id, m.content, m.created_at, m.sender_id
       FROM messages m
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT 5`,
      [userId, offlineUserId]
    );
    console.log(`[RAG-${debugId}] Retrieved ${directHistory.rows.length} direct messages`);

    const messages = directHistory.rows.reverse().map(msg => ({
      role: msg.sender_id === offlineUserId ? 'assistant' : 'user',
      content: msg.content,
      metadata: {
        id: msg.id,
        created_at: msg.created_at,
        sender_id: msg.sender_id
      }
    }));
    console.log(`[RAG-${debugId}] Processed direct messages:`, messages);

    // Analyze and log user's communication style
    const offlineUserMessages = contextMessages.filter(msg => 
      msg.metadata.sender_id === offlineUserId
    ).map(msg => ({ content: msg.content }));
    console.log(`[RAG-${debugId}] Analyzing style for ${offlineUserMessages.length} offline user messages`);
    
    const styleAnalysis = await analyzeUserStyle(offlineUserMessages);
    console.log(`[RAG-${debugId}] Style Analysis Results:`, styleAnalysis);

    const chain = await createConversationalChain(vectorStore, botId);
    console.log(`[RAG-${debugId}] Conversational chain created`);
    
    const directChatHistory = formatChatHistory(messages);
    const relevantChatHistory = formatChatHistory(relevantMessages);
    console.log(`[RAG-${debugId}] Chat histories formatted:`);
    console.log(`[RAG-${debugId}] - Direct chat history length: ${directChatHistory.length}`);
    console.log(`[RAG-${debugId}] - Relevant chat history length: ${relevantChatHistory.length}`);

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

    console.log(`[RAG-${debugId}] System message created with style analysis`);
    console.log(`[RAG-${debugId}] Invoking LLM chain for AFK response`);
    const response = await chain.invoke({
      question: query,
      chat_history: [systemMessage, ...relevantChatHistory, ...directChatHistory]
    });
    console.log(`[RAG-${debugId}] LLM Response received:`, {
      answer: response.text,
      hasSourceDocs: !!response.sourceDocuments,
      sourceDocsCount: response.sourceDocuments?.length
    });

    return {
      answer: response.text,
      sourceDocuments: response.sourceDocuments,
      isAfkResponse: true,
      originalUser: offlineUserId
    };

  } catch (error) {
    console.error(`[RAG-${debugId}] Error in processQuery:`, error);
    console.error(`[RAG-${debugId}] Error stack:`, error.stack);
    throw error;
  }
}

/**
 * Analyzes a user's communication patterns and style based on their message history
 * @param messages Array of user messages with their context
 * @returns Object containing style characteristics with all frequencies normalized to 0-1 scale,
 * where emoji, caps, and exclamation frequencies are calculated per character
 */
async function analyzeUserStyle(messages: any[]) {
  // Calculate total character count and average message length
  const totalCharCount = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  const avgLength = totalCharCount / messages.length;
  
  // Analyze emoji usage (per character)
  const emojiPattern = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojiCount = messages.reduce((sum, msg) => {
    const matches = msg.content.match(emojiPattern) || [];
    return sum + matches.length;
  }, 0);
  const emojiFrequency = emojiCount / totalCharCount;

  // Analyze capitalization patterns (per character)
  const capsCount = messages.reduce((sum, msg) => {
    const words = msg.content.split(/\s+/);
    return sum + words.filter((word: string) => 
      word === word.toUpperCase() && 
      word.length > 1 && 
      !/^[0-9]+$/.test(word) && // Exclude numbers
      !['OK', 'TV', 'PC', 'USA', 'UK', 'EU'].includes(word) // Exclude common acronyms
    ).join('').length;  // Count characters in caps words
  }, 0);
  const capsFrequency = capsCount / totalCharCount;

  // Analyze punctuation patterns (per character)
  const exclamationCount = messages.reduce((sum, msg) => 
    sum + (msg.content.match(/!/g) || []).length, 0
  );
  const questionCount = messages.reduce((sum, msg) => 
    sum + (msg.content.match(/\?/g) || []).length, 0
  );

  // Calculate exclamation frequency per character and cap it at 1.0
  const exclamationFrequency = Math.min(exclamationCount / totalCharCount, 1.0);

  // Analyze response patterns to questions (keep this per message as it's about conversation flow)
  const questionResponses = messages.filter(msg => 
    msg.previous_message?.includes('?')
  ).length;

  return {
    averageLength: avgLength,
    emojiFrequency,
    capsFrequency,
    exclamationFrequency,
    questionFrequency: questionCount / messages.length, // Keep per message as it's about sentence structure
    questionResponseRate: questionResponses / messages.length, // Keep per message as it's about conversation flow
    timestamp: new Date().toISOString()
  };
}