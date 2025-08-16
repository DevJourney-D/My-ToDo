const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { authenticateToken } = require('../middleware/auth');

// ใช้ authentication middleware สำหรับทุก route
router.use(authenticateToken);

// POST /api/todos - สร้าง todo ใหม่
router.post('/', todoController.createTodo);

// GET /api/todos - ดึง todos ทั้งหมดของผู้ใช้
router.get('/', todoController.getUserTodos);

// GET /api/todos/:id - ดึง todo เดียวตาม ID
router.get('/:id', todoController.getTodoById);

// PUT /api/todos/:id - อัพเดท todo
router.put('/:id', todoController.updateTodo);

// PATCH /api/todos/:id - อัพเดท todo (RESTful)
router.patch('/:id', todoController.updateTodo);

// DELETE /api/todos/:id - ลบ todo
router.delete('/:id', todoController.deleteTodo);

// PATCH /api/todos/:id/toggle - ทำเครื่องหมาย todo เป็น completed/uncompleted
router.patch('/:id/toggle', todoController.toggleTodoComplete);

// POST /api/todos/:id/tags - เพิ่ม tag ให้กับ todo (frontend ใช้)
const todoTagController = require('../controllers/todoTag.controller');
router.post('/:id/tags', todoTagController.addTagToTodo);

// DELETE /api/todos/:id/tags/:tagId - ลบ tag ออกจาก todo (frontend ใช้)
router.delete('/:id/tags/:tagId', todoTagController.removeTagFromTodo);

module.exports = router;
