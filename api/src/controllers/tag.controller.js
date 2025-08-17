const TagService = require('../services/tag.service');
const LogService = require('../services/log.service');

class TagController {
  // GET /api/tags - ดึงรายการ tags ทั้งหมด
  static async getTags(req, res) {
    try {
      const userId = req.user.id;
      const { search, limit } = req.query;

      let tags;
      if (search) {
        tags = await TagService.searchTags(userId, search, limit ? parseInt(limit) : 10);
      } else {
        tags = await TagService.getUserTags(userId);
      }

      res.json({
        success: true,
        data: tags,
        meta: {
          total: tags.length
        }
      });
    } catch (error) {
      console.error('Error in getTags:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_tags',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/tags/:id - ดึง tag เดียว
  static async getTagById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const tag = await TagService.getTagById(id, userId);
      
      if (!tag) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      console.error('Error in getTagById:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_tag_by_id',
        tag_id: req.params.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/tags - สร้าง tag ใหม่
  static async createTag(req, res) {
    try {
      const userId = req.user.id;
      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Tag name is required'
        });
      }

      const tag = await TagService.createTag(userId, name.trim());

      res.status(201).json({
        success: true,
        message: 'Tag created successfully',
        data: tag
      });
    } catch (error) {
      console.error('Error in createTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'create_tag',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message === 'Tag name already exists' ? 409 : 500).json({
        success: false,
        message: error.message === 'Tag name already exists' 
          ? 'Tag name already exists' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // PUT /api/tags/:id - อัพเดต tag
  static async updateTag(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const updates = req.body;

      // ดึงข้อมูลเดิมสำหรับ logging
      const oldTag = await TagService.getTagById(id, userId);
      if (!oldTag) {
        return res.status(404).json({
          success: false,
          message: 'Tag not found'
        });
      }

      updates.old_values = {
        name: oldTag.name
      };

      const updatedTag = await TagService.updateTag(id, userId, updates);

      res.json({
        success: true,
        message: 'Tag updated successfully',
        data: updatedTag
      });
    } catch (error) {
      console.error('Error in updateTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_tag',
        tag_id: req.params.id,
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      const status = error.message.includes('not found') ? 404 : 
                    error.message.includes('already exists') ? 409 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message.includes('not found') ? 'Tag not found' :
                error.message.includes('already exists') ? 'Tag name already exists' :
                'Internal server error',
        error: error.message
      });
    }
  }

  // DELETE /api/tags/:id - ลบ tag
  static async deleteTag(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const deletedTag = await TagService.deleteTag(id, userId);

      res.json({
        success: true,
        message: 'Tag deleted successfully',
        data: deletedTag
      });
    } catch (error) {
      console.error('Error in deleteTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'delete_tag',
        tag_id: req.params.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Tag not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/tags/:id/assign/:todoId - เพิ่ม tag ให้ todo
  static async assignTagToTodo(req, res) {
    try {
      const userId = req.user.id;
      const { id: tagId, todoId } = req.params;

      const result = await TagService.assignTagToTodo(userId, todoId, tagId);

      res.json({
        success: true,
        message: result.assigned ? 'Tag assigned to todo successfully' : 'Tag already assigned to todo',
        data: result
      });
    } catch (error) {
      console.error('Error in assignTagToTodo:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'assign_tag_to_todo',
        tag_id: req.params.id,
        todo_id: req.params.todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Tag or Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // DELETE /api/tags/:id/remove/:todoId - ลบ tag ออกจาก todo
  static async removeTagFromTodo(req, res) {
    try {
      const userId = req.user.id;
      const { id: tagId, todoId } = req.params;

      const result = await TagService.removeTagFromTodo(userId, todoId, tagId);

      res.json({
        success: true,
        message: result.removed ? 'Tag removed from todo successfully' : 'Tag was not assigned to todo',
        data: result
      });
    } catch (error) {
      console.error('Error in removeTagFromTodo:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'remove_tag_from_todo',
        tag_id: req.params.id,
        todo_id: req.params.todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Tag or Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/tags/:id/todos - ดึง todos ที่มี tag นี้
  static async getTodosByTag(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const todos = await TagService.getTodosByTag(userId, id);

      res.json({
        success: true,
        data: todos,
        meta: {
          total: todos.length
        }
      });
    } catch (error) {
      console.error('Error in getTodosByTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todos_by_tag',
        tag_id: req.params.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Tag not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/tags/stats - ดึงสถิติ tags
  static async getTagsStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await TagService.getTagsStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getTagsStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_tags_stats',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/tags/popular - ดึง popular tags
  static async getPopularTags(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;
      
      const popularTags = await TagService.getPopularTags(userId, parseInt(limit));

      res.json({
        success: true,
        data: popularTags,
        meta: {
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error in getPopularTags:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_popular_tags',
        error: error.message,
        query_params: req.query,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = TagController;
