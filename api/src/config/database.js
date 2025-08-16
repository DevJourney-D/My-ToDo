const { Pool } = require('pg');
require('dotenv').config();

// สร้าง Pool การเชื่อมต่อโดยดึง Connection String จาก .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // จำนวน connection สูงสุดใน pool
  idleTimeoutMillis: 30000, // ปิด connection ที่ว่างเกิน 30 วินาที
  connectionTimeoutMillis: 2000, // timeout สำหรับการเชื่อมต่อใหม่
});

// จัดการ error ของ pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

// จัดการการเชื่อมต่อใหม่เมื่อ connection หลุด
pool.on('connect', (client) => {
  console.log('New client connected');
});

module.exports = pool;