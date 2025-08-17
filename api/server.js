const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import middleware
const authMiddleware = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all requests
app.use(limiter);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(async (req, res, next) => {
  const startTime = Date.now();
  
  // Log the request
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.ip}`);
  
  // Add completion logging
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Public routes (no authentication required)
app.get('/', (req, res) => {
  res.json({ 
    message: 'My Todo API is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      todos: '/api/todos',
      tags: '/api/tags',
      user: '/api/user',
      analytics: '/api/analytics',
      userData: '/api/user-data',
      todoTags: '/api/todo-tags'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Auth routes (public)
app.use('/api/auth', require('./src/routes/auth'));

// Protected routes (require authentication)
app.use('/api/todos', authMiddleware, require('./src/routes/todos'));
app.use('/api/tags', authMiddleware, require('./src/routes/tags'));
app.use('/api/user', authMiddleware, require('./src/routes/users'));
app.use('/api/analytics', authMiddleware, require('./src/routes/analytics'));
app.use('/api/user-data', authMiddleware, require('./src/routes/userData'));
app.use('/api/todo-tags', authMiddleware, require('./src/routes/todoTags'));
app.use('/api/logs', authMiddleware, require('./src/routes/logs'));

// Global error handler
app.use(async (err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  
  res.status(err.status || 500).json({ 
    success: false,
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - ใช้วิธีนี้แทน app.use('*')
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});

module.exports = app;
