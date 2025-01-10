import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Construct the connection string
const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
});

export default {
  query: (text: string, params: any[]) => {
    console.log('Executing query:', text, 'with params:', params);
    return pool.query(text, params);
  },
};

