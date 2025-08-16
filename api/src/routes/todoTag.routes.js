const express = require('express');
const router = express.Router();
const todoTagController = require('../controllers/todoTag.controller');

// POST /api/todo-tags/todos/:todoId/tags - เพิ่ม tag ให้กับ todo
router.post('/todos/:todoId/tags', todoTagController.addTagToTodo);

// DELETE /api/todo-tags/todos/:todoId/tags/:tagId - ลบ tag ออกจาก todo
router.delete('/todos/:todoId/tags/:tagId', todoTagController.removeTagFromTodo);

// GET /api/todo-tags/todos/:todoId/tags - ดึง tags ทั้งหมดของ todo
router.get('/todos/:todoId/tags', todoTagController.getTodoTags);

// GET /api/todo-tags/tags/:tagId/todos - ดึง todos ทั้งหมดที่มี tag นี้
router.get('/tags/:tagId/todos', todoTagController.getTodosByTag);

// GET /api/todo-tags/todos-with-tags - ดึง todos พร้อม tags ทั้งหมดของผู้ใช้
router.get('/todos-with-tags', todoTagController.getTodosWithTags);

module.exports = router;
