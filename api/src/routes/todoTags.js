const express = require('express');
const TodoTagController = require('../controllers/todoTag.controller');
const router = express.Router();

// Root route - return available endpoints
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Todo-Tags API',
    endpoints: {
      assign: 'POST /',
      remove: 'DELETE /',
      bulk_assign: 'POST /bulk',
      bulk_remove: 'DELETE /bulk',
      update_todo_tags: 'PUT /:todoId',
      stats: '/stats',
      relationships: '/relationships'
    }
  });
});

// Todo-Tag relationship routes
router.post('/', TodoTagController.assignTag);
router.delete('/', TodoTagController.removeTag);

// Bulk operations
router.post('/bulk', TodoTagController.assignMultipleTags);
router.delete('/bulk', TodoTagController.removeMultipleTags);

// Update all tags for a todo
router.put('/:todoId', TodoTagController.updateTodoTags);

// Statistics
router.get('/stats', TodoTagController.getStats);
router.get('/relationships', TodoTagController.getTagRelationships);

module.exports = router;
