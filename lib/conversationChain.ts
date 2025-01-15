import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { createLLM } from './llm';
import { PineconeStore } from '@langchain/pinecone';
import { PromptTemplate } from '@langchain/core/prompts';
import { embeddings, initVectorStore } from './langchain';
import { ContextManager } from './contextManager';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import db from '@/lib/db';

interface ConversationOptions {
  botId: string;
  userId: string;
  conversationId?: string;
  maxContextMessages?: number;
  temperature?: number;
}

const SYSTEM_TEMPLATE = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know. Don't try to make up an answer.
Always maintain a professional and friendly tone.

Context:
{context}

Current conversation:
{chat_history}

Recent commands:
{command_history}

Question: {question}
Helpful Answer:`;

const QUESTION_GENERATOR_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures all relevant context from the conversation history.
If the follow up question is not related to the conversation history, return it as is.

Chat History:
{chat_history}

Follow Up Question: {question}

Standalone question:`;

export async function createConversationChain({
  botId,
  userId,
  conversationId,
  maxContextMessages = 10,
  temperature = 0.7,
}: ConversationOptions) {
  try {
    // Initialize LLM with rate limiting
    const llm = await createLLM({ botId, temperature });
    
    // Initialize context manager
    const contextManager = new ContextManager(botId, userId, maxContextMessages, conversationId);
    await contextManager.initialize();

    // Initialize vector store
    const vectorStore = await initVectorStore();

    // Create the chain
    const chain = ConversationalRetrievalQAChain.fromLLM(
      llm,
      vectorStore.asRetriever(),
      {
        returnSourceDocuments: true,
        questionGeneratorTemplate: QUESTION_GENERATOR_TEMPLATE,
        qaTemplate: SYSTEM_TEMPLATE,
        verbose: process.env.NODE_ENV === 'development',
      }
    );

    // Add methods to manage conversation
    return {
      chain,
      async processMessage(message: string) {
        const startTime = Date.now();
        
        try {
          // Add user message to context
          await contextManager.addMessage(message, 'user');

          // Get relevant context
          const context = await contextManager.getRelevantContext(message);
          
          // Format chat history using LangChain message types
          const chatHistory = context.recentMessages.map(msg => {
            if (msg.role === 'user') {
              return new HumanMessage(msg.content);
            } else {
              return new AIMessage(msg.content);
            }
          });

          // Get response from LLM
          const response = await chain.invoke({
            question: message,
            chat_history: chatHistory,
            context: context.relevantDocuments.join('\n'),
            command_history: context.commandContext.join('\n'),
          });

          // Add assistant's response to context
          await contextManager.addMessage(response.text, 'assistant', {
            sourceDocuments: response.sourceDocuments,
            tokenUsage: response.llmOutput?.tokenUsage,
          });

          // Log feedback
          const responseTime = Date.now() - startTime;
          await db.query(
            `INSERT INTO bot_feedback (
              bot_id, user_id, conversation_id, message_index,
              response_time_ms, token_count
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              botId,
              userId,
              contextManager.getConversationId(),
              context.recentMessages.length,
              responseTime,
              response.llmOutput?.tokenUsage?.totalTokens || 0,
            ]
          );

          return {
            answer: response.text,
            sourceDocuments: response.sourceDocuments,
            conversationId: contextManager.getConversationId(),
          };
        } catch (error) {
          console.error('Error processing message:', error);
          throw error;
        }
      },

      async clearContext() {
        await contextManager.clearContext();
      },

      async getContext() {
        return contextManager.summarizeContext();
      },
    };
  } catch (error) {
    console.error('Error creating conversation chain:', error);
    throw error;
  }
} 