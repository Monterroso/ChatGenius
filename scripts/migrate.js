const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const DATABASE_NAME = process.env.POSTGRES_NAME;
const DATABASE_USER = process.env.POSTGRES_USER;
const DATABASE_PASSWORD = process.env.POSTGRES_PASSWORD;
const DATABASE_HOST = process.env.POSTGRES_HOST;
const DATABASE_PORT = process.env.POSTGRES_PORT || 5432;

// Create a connection pool for the default postgres database
const mainPool = new Pool({
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  database: 'postgres' // Connect to default postgres database first
});

// Pool for our application database
const appPool = new Pool({
  user: DATABASE_USER,
  password: DATABASE_PASSWORD,
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  database: DATABASE_NAME
});

console.log({
  user: DATABASE_USER,
  host: DATABASE_HOST,
  port: DATABASE_PORT,
  database: DATABASE_NAME
  // Not logging password for security
});

async function createDatabaseIfNotExists() {
  const client = await mainPool.connect();
  try {
    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [DATABASE_NAME]
    );

    if (result.rows.length === 0) {
      console.log(`Creating database ${DATABASE_NAME}...`);
      await client.query(`CREATE DATABASE "${DATABASE_NAME}"`);
      console.log('Database created successfully');
    } else {
      console.log('Database already exists');
    }
  } finally {
    client.release();
  }
}

async function applyMigration(filePath) {
  const filename = path.basename(filePath);
  const client = await appPool.connect();
  
  try {
    // Check if migration has already been applied
    const { rows } = await client.query(
      'SELECT filename FROM migrations WHERE filename = $1',
      [filename]
    );

    if (rows.length > 0) {
      console.log(`Migration ${filename} has already been applied, skipping...`);
      return;
    }

    // Apply the migration
    const sql = await fs.readFile(filePath, 'utf-8');
    console.log(filename);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query(
      'INSERT INTO migrations (filename) VALUES ($1)',
      [filename]
    );
    await client.query('COMMIT');
    console.log(`Applied migration: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createMigrationsTable() {
  const client = await appPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Migrations table created/verified');
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    // Create database if it doesn't exist
    await createDatabaseIfNotExists();

    // Create migrations table first
    await createMigrationsTable();

    // Get all migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    
    // Sort migrations by number
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[0]);
        const numB = parseInt(b.split('_')[0]);
        return numA - numB;
      });

    // Apply each migration in order
    for (const file of migrationFiles) {
      await applyMigration(path.join(migrationsDir, file));
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close all pools
    await mainPool.end();
    await appPool.end();
  }
}

// Run migrations
runMigrations(); 