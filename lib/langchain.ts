import { ChatOpenAI } from '@langchain/openai';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API Key');
}

if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
  throw new Error('Missing Pinecone API Key or Index');
}

// Initialize the LLM
export const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone Client
export const initPinecone = async () => {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
};

// Initialize embeddings
export const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: process.env.EMBEDDING_MODEL_NAME,
  dimensions: process.env.EMBEDDING_DIMENSIONS ? parseInt(process.env.EMBEDDING_DIMENSIONS) : 3072,
});

// Initialize vector store
export const initVectorStore = async () => {
  const pinecone = await initPinecone();
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  
  return await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  });
};

// Create a conversational chain
export const createConversationalChain = async (vectorStore: PineconeStore, botId: string) => {
  const retriever = vectorStore.asRetriever({
    filter: { botId },
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
      qaTemplate: `You are a helpful AI assistant. Use the following pieces of context and conversation history to answer the question at the end.
If you don't know the answer, just say that you don't know. Don't try to make up an answer.
Always maintain a professional and friendly tone.

Relevant Context:
{context}

Previous Conversation (with timestamps):
{chat_history}
Each message above includes its timestamp in the metadata (created_at field). You can reference these timestamps when discussing when messages were sent.

Question: {question}
Helpful Answer:`,
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