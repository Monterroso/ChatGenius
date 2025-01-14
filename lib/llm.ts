import { ChatOpenAI } from '@langchain/openai';
import { RateLimiter } from 'limiter';
import db from '@/lib/db';

// Rate limiter: 10k tokens per minute per bot
const rateLimiters = new Map<string, RateLimiter>();

interface LLMOptions {
  botId: string;
  temperature?: number;
  maxTokens?: number;
}

export async function createLLM({ botId, temperature = 0.7, maxTokens = 1000 }: LLMOptions) {
  // Initialize rate limiter for this bot if not exists
  if (!rateLimiters.has(botId)) {
    rateLimiters.set(botId, new RateLimiter({
      tokensPerInterval: 10000,
      interval: 'minute',
    }));
  }

  const limiter = rateLimiters.get(botId)!;

  const llm = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature,
    maxTokens,
    openAIApiKey: process.env.OPENAI_API_KEY,
    callbacks: [
      {
        async handleLLMStart() {
          // Check rate limit before making the call
          const remainingTokens = await limiter.removeTokens(maxTokens);
          if (remainingTokens < 0) {
            throw new Error('Rate limit exceeded. Please try again later.');
          }
        },
        async handleLLMEnd(output) {
          // Log usage metrics
          try {
            const usage = output.llmOutput?.tokenUsage;
            if (usage) {
              await db.query(
                `INSERT INTO bot_metrics (bot_id, total_tokens, prompt_tokens, completion_tokens)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (bot_id) DO UPDATE
                 SET total_tokens = bot_metrics.total_tokens + EXCLUDED.total_tokens,
                     prompt_tokens = bot_metrics.prompt_tokens + EXCLUDED.prompt_tokens,
                     completion_tokens = bot_metrics.completion_tokens + EXCLUDED.completion_tokens`,
                [botId, usage.totalTokens, usage.promptTokens, usage.completionTokens]
              );
            }
          } catch (error) {
            console.error('Error logging metrics:', error);
          }
        },
        async handleLLMError(error) {
          console.error('LLM Error:', error);
          // Log error metrics
          try {
            await db.query(
              `INSERT INTO bot_errors (bot_id, error_type, error_message)
               VALUES ($1, $2, $3)`,
              [botId, error.name, error.message]
            );
          } catch (logError) {
            console.error('Error logging error:', logError);
          }
        },
      },
    ],
  });

  return llm;
} 