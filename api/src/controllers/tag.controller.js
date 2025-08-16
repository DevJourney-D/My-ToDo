const tagService = require('../services/tag.service');
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
 * สร้าง tag ใหม่
 */
const createTag = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const newTag = await tagService.createTag(userId, req.body);
    res.status(201).json(newTag); // ส่งกลับ tag ที่สร้างใหม่โดยตรง
  } catch (error) {
    if (error.message === 'Tag already exists') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error creating tag:', error);
    res.status(500).json({ message: 'Error creating tag', error: error.message });
  }
};

/**
 * ดึง tags ทั้งหมดของผู้ใช้
 */
const getUserTags = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const tags = await tagService.getUserTags(userId);
    // ส่งกลับเป็น array โดยตรงสำหรับ frontend
    res.status(200).json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Error fetching tags', error: error.message });
  }
};

/**
 * ดึง tag เดียวตาม ID
 */
const getTagById = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const tagId = req.params.id;
    const tag = await tagService.getTagById(userId, tagId);
    res.status(200).json({ tag });
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
    res.status(500).json({ message: 'Error fetching tag', error: error.message });
  }
};

/**
 * อัพเดท tag
 */
const updateTag = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const tagId = req.params.id;
    const updatedTag = await tagService.updateTag(userId, tagId, req.body);
    res.status(200).json({ message: 'Tag updated successfully', tag: updatedTag });
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
    if (error.message === 'Tag name already exists') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error updating tag', error: error.message });
  }
};

/**
 * ลบ tag
 */
const deleteTag = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const tagId = req.params.id;
    await tagService.deleteTag(userId, tagId);
    res.status(200).json({ message: 'Tag deleted successfully' });
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
    res.status(500).json({ message: 'Error deleting tag', error: error.message });
  }
};

module.exports = {
  createTag,
  getUserTags,
  getTagById,
  updateTag,
  deleteTag,
};
