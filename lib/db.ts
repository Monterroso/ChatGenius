import { Pool, QueryResult } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.USE_SUPABASE === 'true' 
    ? { rejectUnauthorized: false }
    : false
});

export default {
  query: (text: string, params?: any[]): Promise<QueryResult> => pool.query(text, params),
};

