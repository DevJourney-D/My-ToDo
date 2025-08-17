const TodoTagService = require('../services/todoTag.service');
const LogService = require('../services/log.service');

class TodoTagController {
  // POST /api/todo-tags - เพิ่ม tag ให้ todo
  static async assignTag(req, res) {
    try {
      const userId = req.user.id;
      const { todoId, tagId } = req.body;

      if (!todoId || !tagId) {
        return res.status(400).json({
          success: false,
          message: 'Todo ID and Tag ID are required'
        });
      }

      const result = await TodoTagService.assignTagToTodo(userId, todoId, tagId);

      res.status(201).json({
        success: true,
        message: result.assigned ? 'Tag assigned to todo successfully' : 'Tag already assigned to todo',
        data: result
      });
    } catch (error) {
      console.error('Error in assignTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'assign_tag',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo or Tag not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // DELETE /api/todo-tags - ลบ tag ออกจาก todo
  static async removeTag(req, res) {
    try {
      const userId = req.user.id;
      const { todoId, tagId } = req.body;

      if (!todoId || !tagId) {
        return res.status(400).json({
          success: false,
          message: 'Todo ID and Tag ID are required'
        });
      }

      const result = await TodoTagService.removeTagFromTodo(userId, todoId, tagId);

      res.json({
        success: true,
        message: result.removed ? 'Tag removed from todo successfully' : 'Tag was not assigned to todo',
        data: result
      });
    } catch (error) {
      console.error('Error in removeTag:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'remove_tag',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo or Tag not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/todo-tags/bulk - เพิ่ม tags หลายตัวให้ todo
  static async assignMultipleTags(req, res) {
    try {
      const userId = req.user.id;
      const { todoId, tagIds } = req.body;

      if (!todoId || !tagIds || !Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          message: 'Todo ID and Tag IDs array are required'
        });
      }

      const results = await TodoTagService.assignMultipleTagsToTodo(userId, todoId, tagIds);

      res.status(201).json({
        success: true,
        message: 'Tags assigned to todo successfully',
        data: results
      });
    } catch (error) {
      console.error('Error in assignMultipleTags:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'assign_multiple_tags',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // DELETE /api/todo-tags/bulk - ลบ tags หลายตัวออกจาก todo
  static async removeMultipleTags(req, res) {
    try {
      const userId = req.user.id;
      const { todoId, tagIds } = req.body;

      if (!todoId || !tagIds || !Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          message: 'Todo ID and Tag IDs array are required'
        });
      }

      const results = await TodoTagService.removeMultipleTagsFromTodo(userId, todoId, tagIds);

      res.json({
        success: true,
        message: 'Tags removed from todo successfully',
        data: results
      });
    } catch (error) {
      console.error('Error in removeMultipleTags:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'remove_multiple_tags',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // PUT /api/todo-tags/:todoId - อัพเดท tags ทั้งหมดของ todo
  static async updateTodoTags(req, res) {
    try {
      const userId = req.user.id;
      const { todoId } = req.params;
      const { tagIds } = req.body;

      if (!tagIds || !Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          message: 'Tag IDs array is required'
        });
      }

      const result = await TodoTagService.updateTodoTags(userId, todoId, tagIds);

      res.json({
        success: true,
        message: 'Todo tags updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in updateTodoTags:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_todo_tags',
        todo_id: req.params.todoId,
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/todo-tags/stats - ดึงสถิติ todo-tag relationships
  static async getStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await TodoTagService.getStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todo_tag_stats',
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

  // GET /api/todo-tags/relationships - ดึงความสัมพันธ์ระหว่าง tags
  static async getTagRelationships(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20 } = req.query;
      
      const relationships = await TodoTagService.getTagRelationships(userId, parseInt(limit));

      res.json({
        success: true,
        data: relationships,
        meta: {
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error in getTagRelationships:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_tag_relationships',
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

module.exports = TodoTagController;
