const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Optimized pool settings for Supabase
  max: 3,  // Even lower connection count
  idleTimeoutMillis: 30000,  // Longer idle timeout
  connectionTimeoutMillis: 10000,  // Longer connection timeout
  acquireTimeoutMillis: 60000,  // Add acquire timeout
  // Remove query timeout settings from pool config
  allowExitOnIdle: true  // Allow pool to exit when idle
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
  console.error('Pool error details:', {
    code: err.code,
    severity: err.severity,
    detail: err.detail
  });
});

// Handle connection events
pool.on('connect', (client) => {
  console.log('Database client connected');
});

pool.on('acquire', (client) => {
  console.log('Database client acquired');
});

pool.on('remove', (client) => {
  console.log('Database client removed');
});

module.exports = {
  query: async (text, params) => {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Query executed in', duration, 'ms');
      return result;
    } catch (error) {
      console.error('Database query error:', error.message);
      console.error('Query:', text);
      console.error('Parameters:', params);
      throw error;
    }
  },
  pool
};
