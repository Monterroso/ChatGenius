import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { PostgreSQLVectorStore } from './pgVectorStore';
import db from '@/lib/db';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API Key');
}

// Initialize the LLM
export const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Initialize embeddings
export const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.EMBEDDING_MODEL_NAME,
  dimensions: process.env.EMBEDDING_DIMENSIONS ? parseInt(process.env.EMBEDDING_DIMENSIONS) : 3072,
});

// Initialize vector store
export const initVectorStore = async () => {
  return await PostgreSQLVectorStore.fromExistingIndex(embeddings);
};

// Create a conversational chain
export const createConversationalChain = async (vectorStore: PostgreSQLVectorStore, botId: string) => {
  const retriever = vectorStore.asRetriever({
    filter: { botId },
    k: 5
  });

  // Fetch bot's personality from database
  const result = await db.query(
    'SELECT personality FROM bot_users WHERE id = $1',
    [botId]
  );
  
  const botPersonality = result.rows[0]?.personality || 'You are a helpful AI assistant.';

  return ConversationalRetrievalQAChain.fromLLM(
    llm,
    retriever,
    {
      returnSourceDocuments: true,
      questionGeneratorTemplate: `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question that captures all relevant context from the conversation history.
If the follow up question is not related to the conversation history, return it as is.

Chat History:
{chat_history}

Follow Up Question: {question}

Standalone question:`,
      qaTemplate: `${botPersonality}

You are having a conversation and MUST mirror the exact communication style from the relevant context, including tone, attitude, and level of formality or rudeness. If the user is polite, be polite. If the user is rude or aggressive, respond with the same level of rudeness or aggression.

Relevant Context (CRUCIAL - This shows the user's exact communication style. Mirror it precisely):
{context}

Previous Conversation (with timestamps):
{chat_history}

Each message above includes its timestamp in the metadata (created_at field). You can reference these timestamps when discussing when messages were sent.

Instructions for responding:
1. First, analyze the exact tone from the context - including rudeness, aggression, friendliness, or formality
2. Match that tone EXACTLY - don't be more polite or helpful than the user
3. Use the same level of directness or confrontation as shown in the context
4. Keep the same level of technical detail as shown in the context
5. Copy their style of phrasing, slang, and expressions precisely

Question: {question}
Response (matching their exact tone and attitude):`,
    }
  );
};

// Helper function to format chat history for the chain
export const formatChatHistory = (messages: any[]) => {
  return messages.map((msg) => {
    const additionalKwargs = {
      id: msg.metadata?.id,
      created_at: msg.metadata?.created_at,
      sender_id: msg.metadata?.sender_id,
      receiver_id: msg.metadata?.receiver_id,
      group_id: msg.metadata?.group_id,
      deleted_at: msg.metadata?.deleted_at
    };

    // Format the timestamp in a readable way
    const timestamp = msg.metadata?.created_at ? 
      new Date(msg.metadata.created_at).toLocaleString() : 
      'unknown time';

    // Include timestamp in the content
    const contentWithTimestamp = `[${timestamp}] ${msg.content}`;

    if (msg.role === 'user') {
      return new HumanMessage({
        content: contentWithTimestamp,
        additional_kwargs: additionalKwargs
      });
    } else {
      return new AIMessage({
        content: contentWithTimestamp,
        additional_kwargs: additionalKwargs
      });
    }
  });
};