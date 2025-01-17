import { VectorStore } from "@langchain/core/vectorstores";
import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import db from '@/lib/db';

/**
 * PostgreSQLVectorStore is a custom implementation of LangChain's VectorStore interface
 * that uses PostgreSQL with pgvector extension to store and query embeddings.
 * This implementation allows us to use our local database instead of external services like Pinecone.
 */
export class PostgreSQLVectorStore extends VectorStore {
  _vectorstoreType(): string {
    return "postgresql";
  }

  public embeddings: Embeddings;

  constructor(embeddings: Embeddings) {
    super(embeddings, {});
    this.embeddings = embeddings;
  }

  /**
   * Adds vectors directly to the store
   * @param vectors - Array of vectors to add
   * @param documents - Array of documents corresponding to the vectors
   * @returns Array of document IDs
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const ids: string[] = [];

    for (let i = 0; i < vectors.length; i++) {
      const vectorString = `[${vectors[i].join(',')}]`;
      const messageId = documents[i].metadata?.id || options?.ids?.[i];
      
      if (!messageId) {
        console.error('No message ID provided for embedding');
        continue;
      }

      try {
        const result = await db.query(
          `INSERT INTO message_embeddings (message_id, embedding, metadata)
           VALUES ($1, $2::vector, $3)
           RETURNING id`,
          [
            messageId,
            vectorString,
            {
              ...documents[i].metadata,
              model_name: 'text-embedding-3-small',
              embedding_version: '1.0'
            }
          ]
        );
        ids.push(result.rows[0].id);
      } catch (error: any) {
        if (error.code === '23505') { // Unique violation
          console.log(`Embedding already exists for message ${messageId}, skipping`);
          continue;
        }
        throw error;
      }
    }

    return ids;
  }

  /**
   * Adds documents to the vector store by creating embeddings and storing them in PostgreSQL
   * @param documents - Array of documents to add
   * @param options - Additional metadata for the documents
   * @returns Array of document IDs
   */
  async addDocuments(
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const texts = documents.map((doc) => doc.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    return this.addVectors(vectors, documents, options);
  }

  /**
   * Performs a similarity search using cosine similarity with raw vectors
   * @param query - The query vector to search for
   * @param k - Number of results to return
   * @param filter - Optional filter conditions
   * @returns Array of documents and their similarity scores
   */
  async similaritySearchVectorWithScore(
    query: number[],
    k: number,
    filter?: Record<string, any>
  ): Promise<[Document, number][]> {
    const vectorString = `[${query.join(',')}]`;

    let filterConditions = '';
    const params: any[] = [vectorString, k];
    let paramCount = 3;

    if (filter) {
      const conditions = [];
      for (const [key, value] of Object.entries(filter)) {
        conditions.push(`metadata->>'${key}' = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
      if (conditions.length > 0) {
        filterConditions = 'AND ' + conditions.join(' AND ');
      }
    }

    const result = await db.query(
      `SELECT 
        message_id,
        metadata,
        1 - (embedding <=> $1::vector) as similarity
       FROM message_embeddings
       WHERE 1=1 ${filterConditions}
       ORDER BY similarity DESC
       LIMIT $2`,
      params
    );

    // Fetch the actual messages
    const messageIds = result.rows.map(row => row.message_id);
    const messages = await db.query(
      `SELECT * FROM messages WHERE id = ANY($1)`,
      [messageIds]
    );

    // Create Document objects with scores
    return messages.rows.map((msg, i) => [
      new Document({
        pageContent: msg.content,
        metadata: {
          ...result.rows[i].metadata,
          id: msg.id,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
          receiver_id: msg.receiver_id,
          group_id: msg.group_id,
          similarity: result.rows[i].similarity
        }
      }),
      result.rows[i].similarity
    ]);
  }

  /**
   * Performs a similarity search using cosine similarity
   * @param query - The query text to search for
   * @param k - Number of results to return
   * @param filter - Optional filter conditions
   * @returns Array of documents with their scores
   */
  async similaritySearch(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<Document[]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    const results = await this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
    return results.map(([doc]) => doc);
  }

  /**
   * Performs a similarity search with scores
   * @param query - The query text to search for
   * @param k - Number of results to return
   * @param filter - Optional filter conditions
   * @returns Array of documents and their similarity scores
   */
  async similaritySearchWithScore(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<[Document, number][]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    return this.similaritySearchVectorWithScore(queryEmbedding, k, filter);
  }

  /**
   * Creates a new PostgreSQLVectorStore instance
   * @param embeddings - The embeddings interface to use
   * @returns A new PostgreSQLVectorStore instance
   */
  static async fromExistingIndex(embeddings: Embeddings): Promise<PostgreSQLVectorStore> {
    return new PostgreSQLVectorStore(embeddings);
  }
} 