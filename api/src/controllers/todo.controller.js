const todoService = require('../services/todo.service');
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
 * สร้าง todo ใหม่
 */
const createTodo = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const newTodo = await todoService.createTodo(userId, req.body);
    res.status(201).json(newTodo); // ส่งกลับ todo ที่สร้างใหม่โดยตรง
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ message: 'Error creating todo', error: error.message });
  }
};

/**
 * ดึง todos ทั้งหมดของผู้ใช้
 */
const getUserTodos = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const todos = await todoService.getUserTodos(userId);
    // ส่งกลับเป็น array โดยตรงสำหรับ frontend
    res.status(200).json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ message: 'Error fetching todos', error: error.message });
  }
};

/**
 * ดึง todo เดียวตาม ID
 */
const getTodoById = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const todoId = req.params.id;
    const todo = await todoService.getTodoById(userId, todoId);
    res.status(200).json({ todo });
  } catch (error) {
    if (error.message === 'Todo not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error fetching todo', error: error.message });
  }
};

/**
 * อัพเดท todo
 */
const updateTodo = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const todoId = req.params.id;
    const updatedTodo = await todoService.updateTodo(userId, todoId, req.body);
    res.status(200).json(updatedTodo); // ส่งกลับ todo ที่อัพเดทแล้วโดยตรง
  } catch (error) {
    if (error.message === 'Todo not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating todo', error: error.message });
  }
};

/**
 * ลบ todo
 */
const deleteTodo = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const todoId = req.params.id;
    await todoService.deleteTodo(userId, todoId);
    res.status(200).json({ message: 'Todo deleted successfully' });
  } catch (error) {
    if (error.message === 'Todo not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error deleting todo', error: error.message });
  }
};

/**
 * ทำเครื่องหมาย todo เป็น completed/uncompleted
 */
const toggleTodoComplete = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const todoId = req.params.id;
    const updatedTodo = await todoService.toggleTodoComplete(userId, todoId);
    res.status(200).json(updatedTodo); // ส่งกลับ todo ที่อัพเดทแล้วโดยตรง
  } catch (error) {
    if (error.message === 'Todo not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error toggling todo status', error: error.message });
  }
};

module.exports = {
  createTodo,
  getUserTodos,
  getTodoById,
  updateTodo,
  deleteTodo,
  toggleTodoComplete,
};
