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

// Todo-Tag relationship routes (from todoTags.js)
const TodoTagController = require('../controllers/todoTag.controller');
// Root route - return available endpoints
router.get('/tags', (req, res) => {
	res.json({
		success: true,
		message: 'Todo-Tags API',
		endpoints: {
			assign: 'POST /tags',
			remove: 'DELETE /tags',
			bulk_assign: 'POST /tags/bulk',
			bulk_remove: 'DELETE /tags/bulk',
			update_todo_tags: 'PUT /tags/:todoId',
			stats: '/tags/stats',
			relationships: '/tags/relationships'
		}
	});
});

// Todo-Tag relationship routes
router.post('/tags', TodoTagController.assignTag);
router.delete('/tags', TodoTagController.removeTag);

// Bulk operations
router.post('/tags/bulk', TodoTagController.assignMultipleTags);
router.delete('/tags/bulk', TodoTagController.removeMultipleTags);

// Update all tags for a todo
router.put('/tags/:todoId', TodoTagController.updateTodoTags);

// Statistics
router.get('/tags/stats', TodoTagController.getStats);
router.get('/tags/relationships', TodoTagController.getTagRelationships);