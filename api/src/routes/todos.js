const express = require('express');
const TodoController = require('../controllers/todo.controller');
const router = express.Router();

// Todo routes
router.get('/', TodoController.getTodos);
router.get('/stats', TodoController.getTodoStats);
router.get('/search', TodoController.searchTodos);
router.get('/:id', TodoController.getTodoById);

router.post('/', TodoController.createTodo);

router.put('/:id', TodoController.updateTodo);
router.patch('/:id', TodoController.updateTodo); // เพิ่ม PATCH support
router.put('/:id/toggle', TodoController.toggleComplete);
router.patch('/:id/toggle', TodoController.toggleComplete); // เพิ่ม PATCH support
router.put('/:id/priority', TodoController.updatePriority);
router.patch('/:id/priority', TodoController.updatePriority); // เพิ่ม PATCH support

router.delete('/:id', TodoController.deleteTodo);

module.exports = router;