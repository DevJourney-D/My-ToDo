const TodoService = require('../services/todo.service');
const LogService = require('../services/log.service');

class TodoController {
  // GET /api/todos - ดึงรายการ todos ทั้งหมด
  static async getTodos(req, res) {
    try {
      const userId = req.user.id;
      const { 
        is_completed, 
        priority, 
        due_date, 
        overdue, 
        limit, 
        offset,
        search 
      } = req.query;

      const filters = {};
      if (is_completed !== undefined) filters.is_completed = is_completed === 'true';
      if (priority !== undefined) filters.priority = parseInt(priority);
      if (due_date) filters.due_date = due_date;
      if (overdue === 'true') filters.overdue = true;
      if (limit) filters.limit = parseInt(limit);
      if (offset) filters.offset = parseInt(offset);

      let todos;
      if (search) {
        todos = await TodoService.searchTodos(userId, search, filters);
      } else {
        todos = await TodoService.getUserTodos(userId, filters);
      }

      res.json({
        success: true,
        data: todos,
        meta: {
          total: todos.length // Use simple array length instead of database count
        }
      });
    } catch (error) {
      console.error('Error in getTodos:', error.message);
      console.error('Error stack:', error.stack);
      
      // Log error
      try {
        await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
          action: 'get_todos',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError.message);
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/todos/:id - ดึง todo เดียว
  static async getTodoById(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const todo = await TodoService.getTodoById(id, userId);
      
      if (!todo) {
        return res.status(404).json({
          success: false,
          message: 'Todo not found'
        });
      }

      res.json({
        success: true,
        data: todo
      });
    } catch (error) {
      console.error('Error in getTodoById:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todo_by_id',
        todo_id: req.params.id,
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

  // POST /api/todos - สร้าง todo ใหม่
  static async createTodo(req, res) {
    try {
      const userId = req.user.id;
      const { text, priority = 0, due_date } = req.body;

      if (!text || text.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Todo text is required'
        });
      }

      const todo = await TodoService.createTodo(
        userId, 
        text.trim(), 
        priority, 
        due_date || null
      );

      res.status(201).json({
        success: true,
        message: 'Todo created successfully',
        data: todo
      });
    } catch (error) {
      console.error('Error in createTodo:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'create_todo',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // PUT /api/todos/:id - อัพเดต todo
  static async updateTodo(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const updates = req.body;

      // ดึงข้อมูลเดิมสำหรับ logging
      const oldTodo = await TodoService.getTodoById(id, userId);
      if (!oldTodo) {
        return res.status(404).json({
          success: false,
          message: 'Todo not found'
        });
      }

      updates.old_values = {
        text: oldTodo.text,
        is_completed: oldTodo.is_completed,
        priority: oldTodo.priority,
        due_date: oldTodo.due_date
      };

      const updatedTodo = await TodoService.updateTodo(id, userId, updates);

      res.json({
        success: true,
        message: 'Todo updated successfully',
        data: updatedTodo
      });
    } catch (error) {
      console.error('Error in updateTodo:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_todo',
        todo_id: req.params.id,
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

  // DELETE /api/todos/:id - ลบ todo
  static async deleteTodo(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const deletedTodo = await TodoService.deleteTodo(id, userId);

      res.json({
        success: true,
        message: 'Todo deleted successfully',
        data: deletedTodo
      });
    } catch (error) {
      console.error('Error in deleteTodo:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'delete_todo',
        todo_id: req.params.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // PATCH /api/todos/:id/toggle - เปลี่ยนสถานะ complete/incomplete
  static async toggleComplete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const updatedTodo = await TodoService.toggleComplete(id, userId);

      res.json({
        success: true,
        message: `Todo ${updatedTodo.is_completed ? 'completed' : 'uncompleted'} successfully`,
        data: updatedTodo
      });
    } catch (error) {
      console.error('Error in toggleComplete:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'toggle_todo_complete',
        todo_id: req.params.id,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message.includes('not found') ? 'Todo not found' : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/todos/overdue - ดึง todos ที่ครบกำหนด
  static async getOverdueTodos(req, res) {
    try {
      const userId = req.user.id;
      const todos = await TodoService.getOverdueTodos(userId);

      res.json({
        success: true,
        data: todos,
        meta: {
          total: todos.length
        }
      });
    } catch (error) {
      console.error('Error in getOverdueTodos:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_overdue_todos',
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

  // GET /api/todos/today - ดึง todos ที่กำหนดวันนี้
  static async getTodayTodos(req, res) {
    try {
      const userId = req.user.id;
      const todos = await TodoService.getTodayTodos(userId);

      res.json({
        success: true,
        data: todos,
        meta: {
          total: todos.length
        }
      });
    } catch (error) {
      console.error('Error in getTodayTodos:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_today_todos',
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

  // GET /api/todos/stats - ดึงสถิติ todos
  static async getTodoStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await TodoService.getTodoStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getTodoStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todo_stats',
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

  // GET /api/todos/search - ค้นหา todos
  static async searchTodos(req, res) {
    try {
      const userId = req.user.id;
      const { q, ...filters } = req.query;

      const todos = await TodoService.searchTodos(userId, q, filters);

      res.json({
        success: true,
        data: todos,
        meta: {
          total: todos.length,
          search_query: q,
          filters: filters
        }
      });
    } catch (error) {
      console.error('Error in searchTodos:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'search_todos',
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

  // PUT /api/todos/:id/priority - อัพเดท priority
  static async updatePriority(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { priority } = req.body;

      if (!priority || !['low', 'medium', 'high'].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Valid priority (low, medium, high) is required'
        });
      }

      const updatedTodo = await TodoService.updateTodo(id, userId, { priority });

      res.json({
        success: true,
        message: 'Todo priority updated successfully',
        data: updatedTodo
      });
    } catch (error) {
      console.error('Error in updatePriority:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_priority',
        todo_id: req.params.id,
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
}

module.exports = TodoController;
