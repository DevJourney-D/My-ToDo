const db = require('../config/database');
const LogService = require('./log.service');

class TodoService {
  // สร้าง todo ใหม่
  static async createTodo(userId, text, priority = 0, dueDate = null) {
    try {
      const query = `
        INSERT INTO todos (user_id, text, priority, due_date, is_completed, created_at, updated_at)
        VALUES ($1, $2, $3, $4, false, NOW(), NOW())
        RETURNING *
      `;
      
      const values = [userId, text, priority, dueDate];
      const result = await db.query(query, values);
      const newTodo = result.rows[0];

      // Log การสร้าง todo
      await LogService.createLog(userId, LogService.ACTIONS.TODO_CREATE, {
        todo_id: newTodo.id,
        text: text,
        priority: priority,
        due_date: dueDate,
        created_time: new Date().toISOString()
      });

      return newTodo;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }

  // ดึง todos ทั้งหมดของ user
  static async getUserTodos(userId, filters = {}) {
    try {
      let query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1
      `;

      const queryParams = [userId];
      let paramIndex = 2;

      // เพิ่ม filters
      if (filters.is_completed !== undefined) {
        query += ` AND t.is_completed = $${paramIndex}`;
        queryParams.push(filters.is_completed);
        paramIndex++;
      }

      if (filters.priority !== undefined) {
        query += ` AND t.priority = $${paramIndex}`;
        queryParams.push(filters.priority);
        paramIndex++;
      }

      if (filters.due_date) {
        query += ` AND t.due_date = $${paramIndex}`;
        queryParams.push(filters.due_date);
        paramIndex++;
      }

      if (filters.overdue) {
        query += ` AND t.due_date < CURRENT_DATE AND t.is_completed = false`;
      }

      query += `
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
        ORDER BY t.created_at DESC
      `;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(filters.limit);
        paramIndex++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramIndex}`;
        queryParams.push(filters.offset);
      }

      const result = await db.query(query, queryParams);
      return result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Error getting user todos:', error);
      throw error;
    }
  }

  // ดึง todo ตาม ID
  static async getTodoById(id, userId) {
    try {
      const query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.id = $1 AND t.user_id = $2
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
      `;
      
      const result = await db.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...result.rows[0],
        tags: result.rows[0].tags || []
      };
    } catch (error) {
      console.error('Error getting todo by ID:', error);
      throw error;
    }
  }

  // อัพเดต todo
  static async updateTodo(id, userId, updates) {
    try {
      const allowedUpdates = ['text', 'priority', 'due_date', 'is_completed'];
      const filteredUpdates = {};
      
      // กรองเฉพาะ field ที่อนุญาต
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        throw new Error('No valid update fields provided');
      }

      // สร้าง dynamic query
      const setClause = Object.keys(filteredUpdates)
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const query = `
        UPDATE todos 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const values = [id, userId, ...Object.values(filteredUpdates)];
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Todo not found or unauthorized');
      }

      const updatedTodo = result.rows[0];

      // Log การอัพเดต
      const logAction = filteredUpdates.is_completed !== undefined 
        ? (filteredUpdates.is_completed ? LogService.ACTIONS.TODO_COMPLETE : LogService.ACTIONS.TODO_UNCOMPLETE)
        : LogService.ACTIONS.TODO_UPDATE;

      await LogService.createLog(userId, logAction, {
        todo_id: id,
        updated_fields: Object.keys(filteredUpdates),
        old_values: updates.old_values || null,
        new_values: filteredUpdates,
        updated_time: new Date().toISOString()
      });

      return updatedTodo;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  // ลบ todo
  static async deleteTodo(id, userId) {
    try {
      // ลบ todo_tags ก่อน
      await db.query('DELETE FROM todo_tags WHERE todo_id = $1', [id]);
      
      // ลบ todo
      const query = 'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *';
      const result = await db.query(query, [id, userId]);

      if (result.rows.length === 0) {
        throw new Error('Todo not found or unauthorized');
      }

      const deletedTodo = result.rows[0];

      // Log การลบ
      await LogService.createLog(userId, LogService.ACTIONS.TODO_DELETE, {
        todo_id: id,
        text: deletedTodo.text,
        deleted_time: new Date().toISOString()
      });

      return deletedTodo;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }

  // toggle complete status
  static async toggleComplete(id, userId) {
    try {
      // ดึงสถานะปัจจุบัน
      const currentTodo = await this.getTodoById(id, userId);
      if (!currentTodo) {
        throw new Error('Todo not found');
      }

      const newCompletedStatus = !currentTodo.is_completed;

      const query = `
        UPDATE todos 
        SET is_completed = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *
      `;

      const result = await db.query(query, [newCompletedStatus, id, userId]);
      const updatedTodo = result.rows[0];

      // Log การเปลี่ยนสถานะ
      const logAction = newCompletedStatus 
        ? LogService.ACTIONS.TODO_COMPLETE 
        : LogService.ACTIONS.TODO_UNCOMPLETE;

      await LogService.createLog(userId, logAction, {
        todo_id: id,
        text: updatedTodo.text,
        completed_status: newCompletedStatus,
        toggled_time: new Date().toISOString()
      });

      return updatedTodo;
    } catch (error) {
      console.error('Error toggling todo complete:', error);
      throw error;
    }
  }

  // ดึง todos ที่ครบกำหนด
  static async getOverdueTodos(userId) {
    try {
      const query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1 
          AND t.due_date < CURRENT_DATE 
          AND t.is_completed = false
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
        ORDER BY t.due_date ASC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Error getting overdue todos:', error);
      throw error;
    }
  }

  // ดึง todos ที่กำหนดวันนี้
  static async getTodayTodos(userId) {
    try {
      const query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1 
          AND t.due_date = CURRENT_DATE
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
        ORDER BY t.priority DESC, t.created_at DESC
      `;

      const result = await db.query(query, [userId]);
      return result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Error getting today todos:', error);
      throw error;
    }
  }

  // ค้นหา todos
  static async searchTodos(userId, searchTerm, filters = {}) {
    try {
      let query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1 
          AND t.text ILIKE $2
      `;

      const queryParams = [userId, `%${searchTerm}%`];
      let paramIndex = 3;

      // เพิ่ม filters
      if (filters.is_completed !== undefined) {
        query += ` AND t.is_completed = $${paramIndex}`;
        queryParams.push(filters.is_completed);
        paramIndex++;
      }

      if (filters.priority !== undefined) {
        query += ` AND t.priority = $${paramIndex}`;
        queryParams.push(filters.priority);
        paramIndex++;
      }

      query += `
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
        ORDER BY t.created_at DESC
      `;

      if (filters.limit) {
        query += ` LIMIT $${paramIndex}`;
        queryParams.push(filters.limit);
      }

      const result = await db.query(query, queryParams);
      return result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Error searching todos:', error);
      throw error;
    }
  }

  // นับจำนวน todos
  static async getTodosCount(userId, filters = {}) {
    try {
      let query = 'SELECT COUNT(*) as count FROM todos WHERE user_id = $1';
      const queryParams = [userId];
      let paramIndex = 2;

      if (filters.is_completed !== undefined) {
        query += ` AND is_completed = $${paramIndex}`;
        queryParams.push(filters.is_completed);
        paramIndex++;
      }

      if (filters.priority !== undefined) {
        query += ` AND priority = $${paramIndex}`;
        queryParams.push(filters.priority);
        paramIndex++;
      }

      if (filters.overdue) {
        query += ` AND due_date < CURRENT_DATE AND is_completed = false`;
      }

      const result = await db.query(query, queryParams);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting todos count:', error);
      throw error;
    }
  }
}

module.exports = TodoService;
