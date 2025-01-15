import { searchSimilarDocuments } from './vectorStore';
import db from '@/lib/db';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

interface ConversationContext {
  messages: Message[];
  metadata: {
    lastTopics?: string[];
    relevantDocuments?: string[];
    commandHistory?: string[];
    lastUpdateTime?: Date;
  };
}

export class ContextManager {
  private botId: string;
  private userId: string;
  private conversationId?: string;
  private context: ConversationContext;
  private maxContextMessages: number;

  constructor(
    botId: string,
    userId: string,
    maxContextMessages: number = 10,
    conversationId?: string
  ) {
    this.botId = botId;
    this.userId = userId;
    this.conversationId = conversationId;
    this.maxContextMessages = maxContextMessages;
    this.context = {
      messages: [],
      metadata: {},
    };
  }

  async initialize(): Promise<void> {
    try {
      if (this.conversationId) {
        const result = await db.query(
          'SELECT context FROM bot_conversations WHERE id = $1 AND user_id = $2',
          [this.conversationId, this.userId]
        );
        if (result.rows.length > 0) {
          this.context = result.rows[0].context;
          return;
        }
      }

      // Create new conversation if none exists
      const result = await db.query(
        'INSERT INTO bot_conversations (bot_id, user_id, context) VALUES ($1, $2, $3) RETURNING id, context',
        [this.botId, this.userId, this.context]
      );
      this.conversationId = result.rows[0].id;
    } catch (error) {
      console.error('Error initializing context:', error);
      throw error;
    }
  }

  async addMessage(message: string, role: 'user' | 'assistant', metadata?: Record<string, any>): Promise<void> {
    try {
      // Add message to context
      const newMessage: Message = {
        role,
        content: message,
        metadata,
        timestamp: new Date(),
      };

      this.context.messages.push(newMessage);

      // Keep only the most recent messages based on maxContextMessages
      if (this.context.messages.length > this.maxContextMessages) {
        this.context.messages = this.context.messages.slice(-this.maxContextMessages);
      }

      // Update metadata
      if (role === 'user') {
        // Find relevant documents for user messages
        const relevantDocs = await searchSimilarDocuments(message, this.botId, 3);
        this.context.metadata.relevantDocuments = relevantDocs.map(doc => doc.pageContent);
        
        // Extract and store topics (you could use an NLP service here)
        this.context.metadata.lastTopics = [message.toLowerCase()];
      }

      // Track commands
      if (role === 'user' && message.startsWith('/')) {
        this.context.metadata.commandHistory = [
          ...(this.context.metadata.commandHistory || []),
          message,
        ].slice(-5); // Keep last 5 commands
      }

      this.context.metadata.lastUpdateTime = new Date();

      // Save to database
      await db.query(
        'UPDATE bot_conversations SET context = $1, last_interaction = NOW() WHERE id = $2',
        [this.context, this.conversationId]
      );
    } catch (error) {
      console.error('Error adding message to context:', error);
      throw error;
    }
  }

  async getRelevantContext(message: string): Promise<{
    recentMessages: Message[];
    relevantDocuments: string[];
    commandContext: string[];
  }> {
    try {
      // Get relevant documents
      const relevantDocs = await searchSimilarDocuments(message, this.botId, 3);

      return {
        recentMessages: this.context.messages,
        relevantDocuments: relevantDocs.map(doc => doc.pageContent),
        commandContext: this.context.metadata.commandHistory || [],
      };
    } catch (error) {
      console.error('Error getting relevant context:', error);
      throw error;
    }
  }

  async summarizeContext(): Promise<string> {
    const recentMessages = this.context.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const relevantDocs = this.context.metadata.relevantDocuments
      ? '\nRelevant context:\n' + this.context.metadata.relevantDocuments.join('\n')
      : '';

    const commandHistory = this.context.metadata.commandHistory
      ? '\nRecent commands:\n' + this.context.metadata.commandHistory.join('\n')
      : '';

    return `${recentMessages}${relevantDocs}${commandHistory}`;
  }

  async clearContext(): Promise<void> {
    this.context = {
      messages: [],
      metadata: {},
    };

    await db.query(
      'UPDATE bot_conversations SET context = $1, last_interaction = NOW() WHERE id = $2',
      [this.context, this.conversationId]
    );
  }

  getConversationId(): string | undefined {
    return this.conversationId;
  }
} 