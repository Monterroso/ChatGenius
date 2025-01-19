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
export const createConversationalChain = async (vectorStore: PostgreSQLVectorStore, offlineUserId: string) => {
  const retriever = vectorStore.asRetriever({
    filter: { sender_id: offlineUserId },
    k: 5
  });

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
      qaTemplate: `Relevant Context:
{context}

Previous Conversation:
{chat_history}

Question: {question}
Response:`,
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