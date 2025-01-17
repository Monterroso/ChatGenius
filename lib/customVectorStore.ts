import { VectorStore } from '@langchain/core/vectorstores';
import { Embeddings } from '@langchain/core/embeddings';
import { Document } from '@langchain/core/documents';
import db from '@/lib/db';

/**
 * CustomVectorStore is a LangChain-compatible vector store implementation that uses PostgreSQL with pgvector.
 * It stores embeddings in the message_embeddings table and provides similarity search functionality.
 * This implementation allows us to keep our vector data in our own database rather than using external services.
 */
export class CustomVectorStore extends VectorStore {
  _vectorstoreType(): string {
    return "custom_postgresql";
  }

  public embeddings: Embeddings;

  constructor(embeddings: Embeddings) {
    super(embeddings, {});
    this.embeddings = embeddings;
  }

  /**
   * Adds vectors directly to the store
   * @param vectors - The vectors to add
   * @param documents - The documents associated with the vectors
   * @returns Array of document IDs
   */
  async addVectors(
    vectors: number[][],
    documents: Document[],
    options?: { ids?: string[] }
  ): Promise<string[]> {
    const ids = options?.ids || documents.map(() => crypto.randomUUID());

    for (let i = 0; i < vectors.length; i++) {
      const vectorString = `[${vectors[i].join(',')}]`;
      await db.query(
        `INSERT INTO message_embeddings (message_id, embedding, metadata)
         VALUES ($1, $2::vector, $3)`,
        [
          ids[i],
          vectorString,
          {
            ...documents[i].metadata,
            model_name: 'text-embedding-3-small',
            embedding_version: '1.0'
          }
        ]
      );
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
   * Performs a similarity search using cosine similarity and returns documents with scores
   * @param query - The query vector to search for
   * @param k - Number of results to return
   * @param filter - Optional filter conditions
   * @returns Array of documents with their scores
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

    return result.rows.map((row) => [
      new Document({
        pageContent: row.metadata.content || '',
        metadata: {
          ...row.metadata,
          id: row.message_id
        }
      }),
      row.similarity
    ]);
  }

  /**
   * Performs a similarity search using cosine similarity
   * @param query - The query text to search for
   * @param k - Number of results to return
   * @param filter - Optional filter conditions
   * @returns Array of documents
   */
  async similaritySearch(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<Document[]> {
    const queryVector = await this.embeddings.embedQuery(query);
    const results = await this.similaritySearchVectorWithScore(queryVector, k, filter);
    return results.map(([doc]) => doc);
  }

  /**
   * Deletes documents from the vector store
   * @param params - Parameters for deletion (ids or filter)
   */
  async delete(params: { ids?: string[]; filter?: Record<string, any> }): Promise<void> {
    if (params.ids) {
      await db.query(
        'DELETE FROM message_embeddings WHERE message_id = ANY($1)',
        [params.ids]
      );
    } else if (params.filter) {
      const conditions = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(params.filter)) {
        conditions.push(`metadata->>'${key}' = $${paramCount}`);
        values.push(value);
        paramCount++;
      }

      if (conditions.length > 0) {
        await db.query(
          `DELETE FROM message_embeddings WHERE ${conditions.join(' AND ')}`,
          values
        );
      }
    }
  }

  /**
   * Creates a new instance of the CustomVectorStore
   * @param embeddings - The embeddings implementation to use
   * @returns A new CustomVectorStore instance
   */
  static async fromExistingIndex(embeddings: Embeddings): Promise<CustomVectorStore> {
    return new CustomVectorStore(embeddings);
  }
} 