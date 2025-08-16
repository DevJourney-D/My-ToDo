const todoTagService = require('../services/todoTag.service');
const jwt = require('jsonwebtoken');

/**
 * ดึง userId จาก JWT token
 */
const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Access token required');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.id;
};

/**
 * เพิ่ม tag ให้กับ todo
 */
const addTagToTodo = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const todoId = req.params.todoId;
    const { tagId } = req.body;
    
    const result = await todoTagService.addTagToTodo(userId, todoId, tagId);
    res.status(201).json({ message: 'Tag added to todo successfully', todoTag: result });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message === 'Tag already added to todo') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error adding tag to todo', error: error.message });
  }
};

/**
 * ลบ tag ออกจาก todo
 */
const removeTagFromTodo = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const todoId = req.params.todoId;
    const tagId = req.params.tagId;
    
    await todoTagService.removeTagFromTodo(userId, todoId, tagId);
    res.status(200).json({ message: 'Tag removed from todo successfully' });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.message.includes('not found') || error.message.includes('not associated')) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error removing tag from todo', error: error.message });
  }
};

/**
 * ดึง tags ทั้งหมดของ todo
 */
const getTodoTags = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const todoId = req.params.todoId;
    
    const tags = await todoTagService.getTodoTags(userId, todoId);
    res.status(200).json({ tags });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.message === 'Todo not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error fetching todo tags', error: error.message });
  }
};

/**
 * ดึง todos ทั้งหมดที่มี tag นี้
 */
const getTodosByTag = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const tagId = req.params.tagId;
    
    const todos = await todoTagService.getTodosByTag(userId, tagId);
    res.status(200).json({ todos });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.message === 'Tag not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error fetching todos by tag', error: error.message });
  }
};

/**
 * ดึง todos พร้อม tags ทั้งหมดของผู้ใช้
 */
const getTodosWithTags = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    
    const todos = await todoTagService.getTodosWithTags(userId);
    res.status(200).json({ todos });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching todos with tags', error: error.message });
  }
};

module.exports = {
  addTagToTodo,
  removeTagFromTodo,
  getTodoTags,
  getTodosByTag,
  getTodosWithTags,
};
