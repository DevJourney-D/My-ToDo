require('dotenv').config();
const express = require('express');
const cors = require('cors');

// --- Import Routes ---
const authRoutes = require('./src/routes/auth.routes');
const todoRoutes = require('./src/routes/todo.routes');
const tagRoutes = require('./src/routes/tag.routes');
const todoTagRoutes = require('./src/routes/todoTag.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const userDataRoutes = require('./src/routes/userData.routes');

const app = express();

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Middleware สำหรับ log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => {
  res.send('Hello from To-Do App Backend! 🚀');
});

// --- Use Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/todo-tags', todoTagRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user-data', userDataRoutes);

// เพิ่ม user routes สำหรับ profile management
const userController = require('./src/controllers/user.controller');
app.put('/api/user/password', userController.changePassword || ((req, res) => {
  res.status(501).json({ message: 'Password change not implemented' });
}));

app.put('/api/user/profile', userController.updateProfile || ((req, res) => {
  res.status(501).json({ message: 'Profile update not implemented' });
}));

app.get('/api/user/export', userController.exportUserData || ((req, res) => {
  res.status(501).json({ message: 'Data export not implemented' });
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});