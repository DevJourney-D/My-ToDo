const db = require('../config/database');
const LogService = require('./log.service');

class TodoTagService {
  // เพิ่ม tag ให้กับ todo
  static async assignTagToTodo(userId, todoId, tagId) {
    try {
      // ตรวจสอบว่า todo และ tag มีอยู่จริงและเป็นของ user นี้
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found');
      }

      const tagCheck = await db.query(
        'SELECT id, name FROM tags WHERE id = $1 AND user_id = $2',
        [tagId, userId]
      );

      if (tagCheck.rows.length === 0) {
        throw new Error('Tag not found');
      }

      // ตรวจสอบว่าได้เพิ่ม tag ให้ todo นี้แล้วหรือยัง
      const existingRelation = await db.query(
        'SELECT * FROM todo_tags WHERE todo_id = $1 AND tag_id = $2',
        [todoId, tagId]
      );

      let assigned = false;
      if (existingRelation.rows.length === 0) {
        // เพิ่ม tag ให้ todo
        await db.query(
          'INSERT INTO todo_tags (todo_id, tag_id) VALUES ($1, $2)',
          [todoId, tagId]
        );
        assigned = true;

        // Log การเพิ่ม tag
        await LogService.createLog(userId, LogService.ACTIONS.TAG_ASSIGNED, {
          todo_id: todoId,
          tag_id: tagId,
          tag_name: tagCheck.rows[0].name,
          timestamp: new Date().toISOString()
        });
      }

      return {
        assigned,
        todo_id: todoId,
        tag_id: tagId,
        tag_name: tagCheck.rows[0].name
      };
    } catch (error) {
      console.error('Error in assignTagToTodo:', error);
      throw error;
    }
  }

  // ลบ tag ออกจาก todo
  static async removeTagFromTodo(userId, todoId, tagId) {
    try {
      // ตรวจสอบว่า todo และ tag มีอยู่จริงและเป็นของ user นี้
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found');
      }

      const tagCheck = await db.query(
        'SELECT id, name FROM tags WHERE id = $1 AND user_id = $2',
        [tagId, userId]
      );

      if (tagCheck.rows.length === 0) {
        throw new Error('Tag not found');
      }

      // ลบ tag ออกจาก todo
      const result = await db.query(
        'DELETE FROM todo_tags WHERE todo_id = $1 AND tag_id = $2 RETURNING *',
        [todoId, tagId]
      );

      const removed = result.rows.length > 0;

      if (removed) {
        // Log การลบ tag
        await LogService.createLog(userId, LogService.ACTIONS.TAG_REMOVED, {
          todo_id: todoId,
          tag_id: tagId,
          tag_name: tagCheck.rows[0].name,
          timestamp: new Date().toISOString()
        });
      }

      return {
        removed,
        todo_id: todoId,
        tag_id: tagId,
        tag_name: tagCheck.rows[0].name
      };
    } catch (error) {
      console.error('Error in removeTagFromTodo:', error);
      throw error;
    }
  }

  // เพิ่ม tags หลายตัวให้ todo
  static async assignMultipleTagsToTodo(userId, todoId, tagIds) {
    try {
      // ตรวจสอบว่า todo มีอยู่จริง
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found');
      }

      const results = [];
      
      for (const tagId of tagIds) {
        try {
          const result = await this.assignTagToTodo(userId, todoId, tagId);
          results.push(result);
        } catch (error) {
          results.push({
            assigned: false,
            todo_id: todoId,
            tag_id: tagId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in assignMultipleTagsToTodo:', error);
      throw error;
    }
  }

  // ลบ tags หลายตัวออกจาก todo
  static async removeMultipleTagsFromTodo(userId, todoId, tagIds) {
    try {
      // ตรวจสอบว่า todo มีอยู่จริง
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found');
      }

      const results = [];
      
      for (const tagId of tagIds) {
        try {
          const result = await this.removeTagFromTodo(userId, todoId, tagId);
          results.push(result);
        } catch (error) {
          results.push({
            removed: false,
            todo_id: todoId,
            tag_id: tagId,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in removeMultipleTagsFromTodo:', error);
      throw error;
    }
  }

  // อัพเดต tags ทั้งหมดของ todo (ลบเก่าและเพิ่มใหม่)
  static async updateTodoTags(userId, todoId, tagIds) {
    try {
      // ตรวจสอบว่า todo มีอยู่จริง
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found');
      }

      // ลบ tags เก่าทั้งหมด
      await db.query(
        'DELETE FROM todo_tags WHERE todo_id = $1',
        [todoId]
      );

      // เพิ่ม tags ใหม่
      const results = await this.assignMultipleTagsToTodo(userId, todoId, tagIds);

      // Log การอัพเดต tags
      await LogService.createLog(userId, LogService.ACTIONS.TAGS_UPDATED, {
        todo_id: todoId,
        new_tag_ids: tagIds,
        results_count: results.length,
        timestamp: new Date().toISOString()
      });

      return {
        todo_id: todoId,
        updated_tags: results,
        total_tags: tagIds.length
      };
    } catch (error) {
      console.error('Error in updateTodoTags:', error);
      throw error;
    }
  }

  // ดึงสถิติการใช้ todo-tag relationships
  static async getStats(userId) {
    try {
      const stats = await db.query(`
        SELECT 
          COUNT(DISTINCT tt.todo_id) as todos_with_tags,
          COUNT(DISTINCT tt.tag_id) as tags_used,
          COUNT(*) as total_relationships,
          AVG(tag_counts.tag_count) as avg_tags_per_todo,
          MAX(tag_counts.tag_count) as max_tags_per_todo
        FROM todo_tags tt
        JOIN todos t ON tt.todo_id = t.id
        JOIN tags tg ON tt.tag_id = tg.id
        LEFT JOIN (
          SELECT todo_id, COUNT(*) as tag_count
          FROM todo_tags tt2
          JOIN todos t2 ON tt2.todo_id = t2.id
          WHERE t2.user_id = $1
          GROUP BY todo_id
        ) tag_counts ON tt.todo_id = tag_counts.todo_id
        WHERE t.user_id = $1 AND tg.user_id = $1
      `, [userId]);

      const popularCombinations = await db.query(`
        SELECT 
          t1.name as tag1_name,
          t2.name as tag2_name,
          COUNT(*) as combination_count
        FROM todo_tags tt1
        JOIN todo_tags tt2 ON tt1.todo_id = tt2.todo_id AND tt1.tag_id < tt2.tag_id
        JOIN todos td ON tt1.todo_id = td.id
        JOIN tags t1 ON tt1.tag_id = t1.id
        JOIN tags t2 ON tt2.tag_id = t2.id
        WHERE td.user_id = $1 AND t1.user_id = $1 AND t2.user_id = $1
        GROUP BY t1.name, t2.name
        ORDER BY combination_count DESC
        LIMIT 10
      `, [userId]);

      return {
        ...stats.rows[0],
        popular_combinations: popularCombinations.rows
      };
    } catch (error) {
      console.error('Error in getStats:', error);
      throw error;
    }
  }

  // ดึงความสัมพันธ์ระหว่าง tags
  static async getTagRelationships(userId, limit = 20) {
    try {
      const relationships = await db.query(`
        SELECT 
          t1.id as tag1_id,
          t1.name as tag1_name,
          t2.id as tag2_id,
          t2.name as tag2_name,
          COUNT(*) as co_occurrence_count,
          ROUND(
            COUNT(*) * 100.0 / (
              SELECT COUNT(DISTINCT todo_id) 
              FROM todo_tags tt3 
              JOIN todos td3 ON tt3.todo_id = td3.id 
              WHERE td3.user_id = $1
            ), 2
          ) as co_occurrence_percentage
        FROM todo_tags tt1
        JOIN todo_tags tt2 ON tt1.todo_id = tt2.todo_id AND tt1.tag_id < tt2.tag_id
        JOIN todos td ON tt1.todo_id = td.id
        JOIN tags t1 ON tt1.tag_id = t1.id
        JOIN tags t2 ON tt2.tag_id = t2.id
        WHERE td.user_id = $1 AND t1.user_id = $1 AND t2.user_id = $1
        GROUP BY t1.id, t1.name, t2.id, t2.name
        ORDER BY co_occurrence_count DESC, co_occurrence_percentage DESC
        LIMIT $2
      `, [userId, limit]);

      return relationships.rows;
    } catch (error) {
      console.error('Error in getTagRelationships:', error);
      throw error;
    }
  }
}

module.exports = TodoTagService;
