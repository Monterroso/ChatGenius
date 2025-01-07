import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default {
  query: (text: string, params?: any[]): Promise<QueryResult> => pool.query(text, params),
};

