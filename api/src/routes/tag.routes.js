const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controller');
const { authenticateToken } = require('../middleware/auth');

// ใช้ authentication middleware สำหรับทุก route
router.use(authenticateToken);

// POST /api/tags - สร้าง tag ใหม่
router.post('/', tagController.createTag);

// GET /api/tags - ดึง tags ทั้งหมดของผู้ใช้
router.get('/', tagController.getUserTags);

// GET /api/tags/:id - ดึง tag เดียวตาม ID
router.get('/:id', tagController.getTagById);

// PUT /api/tags/:id - อัพเดท tag
router.put('/:id', tagController.updateTag);

// DELETE /api/tags/:id - ลบ tag
router.delete('/:id', tagController.deleteTag);

module.exports = router;
