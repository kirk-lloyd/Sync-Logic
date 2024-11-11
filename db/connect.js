import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: false, // Disabling SSL since the server does not support SSL connections
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client', err.stack);
  } else {
    console.log('PostgreSQL database connected successfully.');
    release();
  }
});

// Function to initialize the database (if required)
export async function initializeDatabase() {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS stores (
        shop_id VARCHAR(255) PRIMARY KEY,
        shop_domain VARCHAR(255) UNIQUE NOT NULL,
        access_token VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    );
    console.log('Database initialized and tables created if they did not exist.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export { pool };
