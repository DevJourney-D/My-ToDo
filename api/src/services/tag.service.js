const db = require('../config/database');
const LogService = require('./log.service');

class TagService {
  // สร้าง tag ใหม่
  static async createTag(userId, name) {
    try {
      // เช็คว่า tag name ซ้ำหรือไม่ (ของ user คนเดียวกัน)
      const existingTag = await this.getTagByName(userId, name);
      if (existingTag) {
        throw new Error('Tag name already exists');
      }

      const query = `
        INSERT INTO tags (user_id, name, created_at)
        VALUES ($1, $2, NOW())
        RETURNING *
      `;
      
      const values = [userId, name];
      const result = await db.query(query, values);
      const newTag = result.rows[0];

      // Log การสร้าง tag
      await LogService.createLog(userId, LogService.ACTIONS.TAG_CREATE, {
        tag_id: newTag.id,
        name: name,
        created_time: new Date().toISOString()
      });

      return newTag;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  }

  // ดึง tags ทั้งหมดของ user
  static async getUserTags(userId) {
    try {
      const query = `
        SELECT t.*, COUNT(tt.todo_id) as usage_count
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        WHERE t.user_id = $1
        GROUP BY t.id, t.user_id, t.name, t.created_at
        ORDER BY usage_count DESC, t.created_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows.map(row => ({
        ...row,
        usage_count: parseInt(row.usage_count)
      }));
    } catch (error) {
      console.error('Error getting user tags:', error);
      throw error;
    }
  }

  // ดึง tag ตาม ID
  static async getTagById(id, userId) {
    try {
      const query = `
        SELECT t.*, COUNT(tt.todo_id) as usage_count
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        WHERE t.id = $1 AND t.user_id = $2
        GROUP BY t.id, t.user_id, t.name, t.created_at
      `;
      
      const result = await db.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...result.rows[0],
        usage_count: parseInt(result.rows[0].usage_count)
      };
    } catch (error) {
      console.error('Error getting tag by ID:', error);
      throw error;
    }
  }

  // ดึง tag ตาม name
  static async getTagByName(userId, name) {
    try {
      const query = 'SELECT * FROM tags WHERE user_id = $1 AND name = $2';
      const result = await db.query(query, [userId, name]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting tag by name:', error);
      throw error;
    }
  }

  // อัพเดต tag
  static async updateTag(id, userId, updates) {
    try {
      const allowedUpdates = ['name'];
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

      // เช็คว่า tag name ซ้ำหรือไม่ (ถ้ามีการอัพเดต name)
      if (filteredUpdates.name) {
        const existingTag = await this.getTagByName(userId, filteredUpdates.name);
        if (existingTag && existingTag.id !== id) {
          throw new Error('Tag name already exists');
        }
      }

      // สร้าง dynamic query
      const setClause = Object.keys(filteredUpdates)
        .map((key, index) => `${key} = $${index + 3}`)
        .join(', ');

      const query = `
        UPDATE tags 
        SET ${setClause}
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      const values = [id, userId, ...Object.values(filteredUpdates)];
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Tag not found or unauthorized');
      }

      const updatedTag = result.rows[0];

      // Log การอัพเดต
      await LogService.createLog(userId, LogService.ACTIONS.TAG_UPDATE, {
        tag_id: id,
        updated_fields: Object.keys(filteredUpdates),
        old_values: updates.old_values || null,
        new_values: filteredUpdates,
        updated_time: new Date().toISOString()
      });

      return updatedTag;
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  }

  // ลบ tag
  static async deleteTag(id, userId) {
    try {
      // ลบ todo_tags ก่อน
      await db.query('DELETE FROM todo_tags WHERE tag_id = $1', [id]);
      
      // ลบ tag
      const query = 'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING *';
      const result = await db.query(query, [id, userId]);

      if (result.rows.length === 0) {
        throw new Error('Tag not found or unauthorized');
      }

      const deletedTag = result.rows[0];

      // Log การลบ
      await LogService.createLog(userId, LogService.ACTIONS.TAG_DELETE, {
        tag_id: id,
        name: deletedTag.name,
        deleted_time: new Date().toISOString()
      });

      return deletedTag;
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  }

  // เพิ่ม tag ให้ todo
  static async assignTagToTodo(userId, todoId, tagId) {
    try {
      // ตรวจสอบว่า todo เป็นของ user นี้
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found or unauthorized');
      }

      // ตรวจสอบว่า tag เป็นของ user นี้
      const tagCheck = await db.query(
        'SELECT id, name FROM tags WHERE id = $1 AND user_id = $2',
        [tagId, userId]
      );

      if (tagCheck.rows.length === 0) {
        throw new Error('Tag not found or unauthorized');
      }

      // เพิ่ม tag ให้ todo (ใช้ ON CONFLICT เพื่อป้องกันการ duplicate)
      const query = `
        INSERT INTO todo_tags (todo_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT (todo_id, tag_id) DO NOTHING
        RETURNING *
      `;

      const result = await db.query(query, [todoId, tagId]);
      
      // Log การ assign tag
      await LogService.createLog(userId, LogService.ACTIONS.TAG_ASSIGN, {
        todo_id: todoId,
        tag_id: tagId,
        tag_name: tagCheck.rows[0].name,
        assigned_time: new Date().toISOString()
      });

      return {
        todo_id: todoId,
        tag_id: tagId,
        assigned: result.rows.length > 0 // true ถ้าเพิ่มใหม่, false ถ้ามีอยู่แล้ว
      };
    } catch (error) {
      console.error('Error assigning tag to todo:', error);
      throw error;
    }
  }

  // ลบ tag ออกจาก todo
  static async removeTagFromTodo(userId, todoId, tagId) {
    try {
      // ตรวจสอบว่า todo เป็นของ user นี้
      const todoCheck = await db.query(
        'SELECT id FROM todos WHERE id = $1 AND user_id = $2',
        [todoId, userId]
      );

      if (todoCheck.rows.length === 0) {
        throw new Error('Todo not found or unauthorized');
      }

      // ตรวจสอบว่า tag เป็นของ user นี้
      const tagCheck = await db.query(
        'SELECT id, name FROM tags WHERE id = $1 AND user_id = $2',
        [tagId, userId]
      );

      if (tagCheck.rows.length === 0) {
        throw new Error('Tag not found or unauthorized');
      }

      // ลบ tag ออกจาก todo
      const query = 'DELETE FROM todo_tags WHERE todo_id = $1 AND tag_id = $2 RETURNING *';
      const result = await db.query(query, [todoId, tagId]);

      // Log การ remove tag
      await LogService.createLog(userId, LogService.ACTIONS.TAG_UNASSIGN, {
        todo_id: todoId,
        tag_id: tagId,
        tag_name: tagCheck.rows[0].name,
        removed_time: new Date().toISOString()
      });

      return {
        todo_id: todoId,
        tag_id: tagId,
        removed: result.rows.length > 0
      };
    } catch (error) {
      console.error('Error removing tag from todo:', error);
      throw error;
    }
  }

  // ดึง todos ที่มี tag นี้
  static async getTodosByTag(userId, tagId) {
    try {
      // ตรวจสอบว่า tag เป็นของ user นี้
      const tagCheck = await this.getTagById(tagId, userId);
      if (!tagCheck) {
        throw new Error('Tag not found or unauthorized');
      }

      const query = `
        SELECT t.*, 
               array_agg(DISTINCT jsonb_build_object('id', tag.id, 'name', tag.name)) 
               FILTER (WHERE tag.id IS NOT NULL) as tags
        FROM todos t
        INNER JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN todo_tags tt2 ON t.id = tt2.todo_id
        LEFT JOIN tags tag ON tt2.tag_id = tag.id
        WHERE t.user_id = $1 AND tt.tag_id = $2
        GROUP BY t.id, t.user_id, t.text, t.is_completed, t.priority, t.due_date, t.created_at, t.updated_at
        ORDER BY t.created_at DESC
      `;

      const result = await db.query(query, [userId, tagId]);
      return result.rows.map(row => ({
        ...row,
        tags: row.tags || []
      }));
    } catch (error) {
      console.error('Error getting todos by tag:', error);
      throw error;
    }
  }

  // ค้นหา tags
  static async searchTags(userId, searchTerm, limit = 10) {
    try {
      const query = `
        SELECT t.*, COUNT(tt.todo_id) as usage_count
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        WHERE t.user_id = $1 AND t.name ILIKE $2
        GROUP BY t.id, t.user_id, t.name, t.created_at
        ORDER BY usage_count DESC, t.created_at DESC
        LIMIT $3
      `;
      
      const result = await db.query(query, [userId, `%${searchTerm}%`, limit]);
      return result.rows.map(row => ({
        ...row,
        usage_count: parseInt(row.usage_count)
      }));
    } catch (error) {
      console.error('Error searching tags:', error);
      throw error;
    }
  }

  // ดึงสถิติ tags
  static async getTagsStats(userId) {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT t.id) as total_tags,
          COUNT(tt.todo_id) as total_usages,
          AVG(tag_usage.usage_count) as avg_usage_per_tag
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        LEFT JOIN (
          SELECT tag_id, COUNT(*) as usage_count
          FROM todo_tags
          GROUP BY tag_id
        ) tag_usage ON t.id = tag_usage.tag_id
        WHERE t.user_id = $1
      `;

      const result = await db.query(query, [userId]);
      const stats = result.rows[0];

      return {
        total_tags: parseInt(stats.total_tags),
        total_usages: parseInt(stats.total_usages),
        avg_usage_per_tag: parseFloat(stats.avg_usage_per_tag || 0).toFixed(2)
      };
    } catch (error) {
      console.error('Error getting tags stats:', error);
      throw error;
    }
  }

  // ดึง popular tags
  static async getPopularTags(userId, limit = 10) {
    try {
      const query = `
        SELECT t.*, COUNT(tt.todo_id) as usage_count
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        WHERE t.user_id = $1
        GROUP BY t.id, t.user_id, t.name, t.created_at
        HAVING COUNT(tt.todo_id) > 0
        ORDER BY usage_count DESC, t.created_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [userId, limit]);
      return result.rows.map(row => ({
        ...row,
        usage_count: parseInt(row.usage_count)
      }));
    } catch (error) {
      console.error('Error getting popular tags:', error);
      throw error;
    }
  }
}

module.exports = TagService;
