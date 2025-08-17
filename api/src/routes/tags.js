const express = require('express');
const TagController = require('../controllers/tag.controller');
const router = express.Router();

// Tag routes
router.get('/', TagController.getTags);
router.get('/stats', TagController.getTagsStats);
router.get('/popular', TagController.getPopularTags);
router.get('/:id', TagController.getTagById);
router.get('/:id/todos', TagController.getTodosByTag);

router.post('/', TagController.createTag);
router.post('/:id/assign/:todoId', TagController.assignTagToTodo);

router.put('/:id', TagController.updateTag);
router.patch('/:id', TagController.updateTag); // เพิ่ม PATCH support

router.delete('/:id', TagController.deleteTag);
router.delete('/:id/remove/:todoId', TagController.removeTagFromTodo);

module.exports = router;