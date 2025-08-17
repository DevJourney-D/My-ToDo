const db = require('../config/database');
const LogService = require('./log.service');
const TodoService = require('./todo.service');
const TagService = require('./tag.service');

class UserDataService {
  // สร้าง backup ข้อมูลผู้ใช้
  static async createBackup(userId, options = {}) {
    try {
      const { format = 'json', includeMetadata = true } = options;

      // ดึงข้อมูลผู้ใช้
      const userResult = await db.query(
        'SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // ดึงข้อมูล todos
      const todosResult = await db.query(`
        SELECT id, title, description, completed, priority, due_date, created_at, updated_at
        FROM todos 
        WHERE user_id = $1 
        ORDER BY created_at
      `, [userId]);

      // ดึงข้อมูล tags
      const tagsResult = await db.query(`
        SELECT id, name, created_at, updated_at
        FROM tags 
        WHERE user_id = $1 
        ORDER BY created_at
      `, [userId]);

      // ดึงข้อมูล todo_tags relationships
      const todoTagsResult = await db.query(`
        SELECT tt.todo_id, tt.tag_id, t.title as todo_title, tg.name as tag_name
        FROM todo_tags tt
        JOIN todos t ON tt.todo_id = t.id
        JOIN tags tg ON tt.tag_id = tg.id
        WHERE t.user_id = $1 AND tg.user_id = $1
        ORDER BY tt.todo_id, tt.tag_id
      `, [userId]);

      // ดึงข้อมูล logs (ถ้าต้องการ)
      const logsResult = includeMetadata ? await db.query(`
        SELECT action, data, created_at
        FROM logs 
        WHERE user_id = $1 
        ORDER BY created_at DESC
        LIMIT 1000
      `, [userId]) : { rows: [] };

      const backupData = {
        backup_info: {
          created_at: new Date().toISOString(),
          user_id: userId,
          version: '1.0',
          format
        },
        user: user,
        todos: todosResult.rows,
        tags: tagsResult.rows,
        todo_tags: todoTagsResult.rows,
        ...(includeMetadata && { logs: logsResult.rows })
      };

      // Log การสร้าง backup
      await LogService.createLog(userId, LogService.ACTIONS.DATA_BACKUP_CREATED, {
        backup_size: JSON.stringify(backupData).length,
        todos_count: todosResult.rows.length,
        tags_count: tagsResult.rows.length,
        relationships_count: todoTagsResult.rows.length,
        timestamp: new Date().toISOString()
      });

      return backupData;
    } catch (error) {
      console.error('Error in createBackup:', error);
      throw error;
    }
  }

  // คืนค่าข้อมูลจาก backup
  static async restoreFromBackup(userId, backupData, options = {}) {
    try {
      const { replaceExisting = false, skipErrors = true } = options;

      if (!backupData || !backupData.user || !Array.isArray(backupData.todos)) {
        throw new Error('Invalid backup data format');
      }

      const results = {
        todos_restored: 0,
        tags_restored: 0,
        relationships_restored: 0,
        errors: []
      };

      // เริ่ม transaction
      await db.query('BEGIN');

      try {
        // ถ้าต้องการแทนที่ข้อมูลเดิม
        if (replaceExisting) {
          await db.query('DELETE FROM todo_tags WHERE todo_id IN (SELECT id FROM todos WHERE user_id = $1)', [userId]);
          await db.query('DELETE FROM todos WHERE user_id = $1', [userId]);
          await db.query('DELETE FROM tags WHERE user_id = $1', [userId]);
        }

        // สร้าง mapping สำหรับ ID เดิมกับ ID ใหม่
        const todoIdMap = new Map();
        const tagIdMap = new Map();

        // Restore tags ก่อน
        if (Array.isArray(backupData.tags)) {
          for (const tag of backupData.tags) {
            try {
              const result = await db.query(
                'INSERT INTO tags (user_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4) RETURNING id',
                [userId, tag.name, tag.created_at, tag.updated_at]
              );
              tagIdMap.set(tag.id, result.rows[0].id);
              results.tags_restored++;
            } catch (error) {
              if (skipErrors) {
                results.errors.push(`Tag "${tag.name}": ${error.message}`);
              } else {
                throw error;
              }
            }
          }
        }

        // Restore todos
        for (const todo of backupData.todos) {
          try {
            const result = await db.query(`
              INSERT INTO todos (user_id, title, description, completed, priority, due_date, created_at, updated_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
              RETURNING id
            `, [
              userId, 
              todo.title, 
              todo.description, 
              todo.completed, 
              todo.priority, 
              todo.due_date, 
              todo.created_at, 
              todo.updated_at
            ]);
            todoIdMap.set(todo.id, result.rows[0].id);
            results.todos_restored++;
          } catch (error) {
            if (skipErrors) {
              results.errors.push(`Todo "${todo.title}": ${error.message}`);
            } else {
              throw error;
            }
          }
        }

        // Restore todo-tag relationships
        if (Array.isArray(backupData.todo_tags)) {
          for (const relation of backupData.todo_tags) {
            try {
              const newTodoId = todoIdMap.get(relation.todo_id);
              const newTagId = tagIdMap.get(relation.tag_id);

              if (newTodoId && newTagId) {
                await db.query(
                  'INSERT INTO todo_tags (todo_id, tag_id) VALUES ($1, $2)',
                  [newTodoId, newTagId]
                );
                results.relationships_restored++;
              }
            } catch (error) {
              if (skipErrors) {
                results.errors.push(`Relationship: ${error.message}`);
              } else {
                throw error;
              }
            }
          }
        }

        await db.query('COMMIT');

        // Log การ restore
        await LogService.createLog(userId, LogService.ACTIONS.DATA_BACKUP_RESTORED, {
          ...results,
          replace_existing: replaceExisting,
          timestamp: new Date().toISOString()
        });

        return results;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error in restoreFromBackup:', error);
      throw error;
    }
  }

  // ส่งออกข้อมูลในรูปแบบต่างๆ
  static async exportData(userId, options = {}) {
    try {
      const { 
        format = 'json', 
        dataTypes = ['todos', 'tags'], 
        dateRange = null,
        compress = false 
      } = options;

      const exportData = {};

      // Export todos
      if (dataTypes.includes('todos')) {
        let todoQuery = 'SELECT * FROM todos WHERE user_id = $1';
        const params = [userId];

        if (dateRange && dateRange.start && dateRange.end) {
          todoQuery += ' AND created_at BETWEEN $2 AND $3';
          params.push(dateRange.start, dateRange.end);
        }

        todoQuery += ' ORDER BY created_at';

        const todosResult = await db.query(todoQuery, params);
        exportData.todos = todosResult.rows;
      }

      // Export tags
      if (dataTypes.includes('tags')) {
        const tagsResult = await db.query(
          'SELECT * FROM tags WHERE user_id = $1 ORDER BY created_at',
          [userId]
        );
        exportData.tags = tagsResult.rows;
      }

      // Export logs
      if (dataTypes.includes('logs')) {
        let logQuery = 'SELECT * FROM logs WHERE user_id = $1';
        const params = [userId];

        if (dateRange && dateRange.start && dateRange.end) {
          logQuery += ' AND created_at BETWEEN $2 AND $3';
          params.push(dateRange.start, dateRange.end);
        }

        logQuery += ' ORDER BY created_at DESC LIMIT 5000';

        const logsResult = await db.query(logQuery, params);
        exportData.logs = logsResult.rows;
      }

      // Format data
      let result;
      if (format === 'csv') {
        result = this.convertToCSV(exportData);
      } else {
        result = exportData;
      }

      // Log การ export
      await LogService.createLog(userId, LogService.ACTIONS.DATA_EXPORTED, {
        format,
        data_types: dataTypes,
        date_range: dateRange,
        records_count: Object.keys(exportData).reduce((sum, key) => 
          sum + (Array.isArray(exportData[key]) ? exportData[key].length : 0), 0
        ),
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      console.error('Error in exportData:', error);
      throw error;
    }
  }

  // นำเข้าข้อมูล
  static async importData(userId, data, format = 'json', options = {}) {
    try {
      const { validateOnly = false, skipDuplicates = true } = options;

      let parsedData;
      if (format === 'json') {
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      } else if (format === 'csv') {
        parsedData = this.parseCSV(data);
      } else {
        throw new Error('Unsupported import format');
      }

      const results = {
        todos_imported: 0,
        tags_imported: 0,
        errors: [],
        validation_only: validateOnly
      };

      if (validateOnly) {
        // ตรวจสอบความถูกต้องของข้อมูลเท่านั้น
        return this.validateImportData(parsedData);
      }

      // Import จริง
      await db.query('BEGIN');

      try {
        // Import tags
        if (parsedData.tags && Array.isArray(parsedData.tags)) {
          for (const tag of parsedData.tags) {
            try {
              if (skipDuplicates) {
                const existing = await db.query(
                  'SELECT id FROM tags WHERE user_id = $1 AND name = $2',
                  [userId, tag.name]
                );
                if (existing.rows.length > 0) continue;
              }

              await db.query(
                'INSERT INTO tags (user_id, name) VALUES ($1, $2)',
                [userId, tag.name]
              );
              results.tags_imported++;
            } catch (error) {
              results.errors.push(`Tag "${tag.name}": ${error.message}`);
            }
          }
        }

        // Import todos
        if (parsedData.todos && Array.isArray(parsedData.todos)) {
          for (const todo of parsedData.todos) {
            try {
              await db.query(`
                INSERT INTO todos (user_id, title, description, completed, priority, due_date) 
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                userId,
                todo.title,
                todo.description || null,
                todo.completed || false,
                todo.priority || 'medium',
                todo.due_date || null
              ]);
              results.todos_imported++;
            } catch (error) {
              results.errors.push(`Todo "${todo.title}": ${error.message}`);
            }
          }
        }

        await db.query('COMMIT');

        // Log การ import
        await LogService.createLog(userId, LogService.ACTIONS.DATA_IMPORTED, {
          ...results,
          format,
          timestamp: new Date().toISOString()
        });

        return results;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error in importData:', error);
      throw error;
    }
  }

  // สถิติการใช้งานข้อมูล
  static async getDataStatistics(userId) {
    try {
      const stats = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM todos WHERE user_id = $1) as total_todos,
          (SELECT COUNT(*) FROM todos WHERE user_id = $1 AND completed = true) as completed_todos,
          (SELECT COUNT(*) FROM tags WHERE user_id = $1) as total_tags,
          (SELECT COUNT(*) FROM todo_tags tt JOIN todos t ON tt.todo_id = t.id WHERE t.user_id = $1) as total_relationships,
          (SELECT COUNT(*) FROM logs WHERE user_id = $1) as total_logs,
          (SELECT created_at FROM users WHERE id = $1) as account_created
      `, [userId]);

      const recentActivity = await db.query(`
        SELECT action, COUNT(*) as count
        FROM logs 
        WHERE user_id = $1 
          AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY action
        ORDER BY count DESC
        LIMIT 10
      `, [userId]);

      const dataSize = await db.query(`
        SELECT 
          pg_size_pretty(SUM(pg_total_relation_size(tablename::regclass))) as estimated_size
        FROM (
          SELECT 'todos' as tablename
          UNION SELECT 'tags'
          UNION SELECT 'todo_tags'
          UNION SELECT 'logs'
        ) t
      `);

      return {
        ...stats.rows[0],
        recent_activity: recentActivity.rows,
        estimated_data_size: dataSize.rows[0].estimated_size
      };
    } catch (error) {
      console.error('Error in getDataStatistics:', error);
      throw error;
    }
  }

  // ทำความสะอาดข้อมูลเก่า
  static async cleanupOldData(userId, options = {}) {
    try {
      const { olderThan = 90, dataTypes = ['logs'], dryRun = false } = options;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThan);

      const results = {};

      for (const dataType of dataTypes) {
        if (dataType === 'logs') {
          const countQuery = 'SELECT COUNT(*) FROM logs WHERE user_id = $1 AND created_at < $2';
          const countResult = await db.query(countQuery, [userId, cutoffDate]);
          
          results.logs = {
            count_to_delete: parseInt(countResult.rows[0].count),
            cutoff_date: cutoffDate.toISOString()
          };

          if (!dryRun && results.logs.count_to_delete > 0) {
            await db.query(
              'DELETE FROM logs WHERE user_id = $1 AND created_at < $2',
              [userId, cutoffDate]
            );
          }
        }
      }

      if (!dryRun) {
        await LogService.createLog(userId, LogService.ACTIONS.DATA_CLEANUP, {
          ...results,
          older_than_days: olderThan,
          data_types: dataTypes,
          timestamp: new Date().toISOString()
        });
      }

      return results;
    } catch (error) {
      console.error('Error in cleanupOldData:', error);
      throw error;
    }
  }

  // ตรวจสอบความสมบูรณ์ของข้อมูล
  static async checkDataIntegrity(userId) {
    try {
      const issues = [];

      // ตรวจสอบ orphaned todo_tags
      const orphanedTodoTags = await db.query(`
        SELECT tt.* FROM todo_tags tt
        LEFT JOIN todos t ON tt.todo_id = t.id
        LEFT JOIN tags tg ON tt.tag_id = tg.id
        WHERE t.id IS NULL OR tg.id IS NULL
      `);

      if (orphanedTodoTags.rows.length > 0) {
        issues.push({
          type: 'orphaned_todo_tags',
          count: orphanedTodoTags.rows.length,
          description: 'Todo-tag relationships without valid todo or tag'
        });
      }

      // ตรวจสอบ todos ที่ไม่มี user
      const orphanedTodos = await db.query(`
        SELECT t.* FROM todos t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE u.id IS NULL
      `);

      if (orphanedTodos.rows.length > 0) {
        issues.push({
          type: 'orphaned_todos',
          count: orphanedTodos.rows.length,
          description: 'Todos without valid user'
        });
      }

      // สถิติทั่วไป
      const stats = await this.getDataStatistics(userId);

      return {
        integrity_check_date: new Date().toISOString(),
        issues,
        overall_health: issues.length === 0 ? 'good' : 'needs_attention',
        statistics: stats
      };
    } catch (error) {
      console.error('Error in checkDataIntegrity:', error);
      throw error;
    }
  }

  // ซิงค์ข้อมูล (พื้นฐาน)
  static async syncData(userId, syncOptions = {}) {
    try {
      const { deviceId, lastSyncTimestamp, localChanges = [] } = syncOptions;

      // ดึงข้อมูลที่เปลี่ยนแปลงหลังจาก lastSyncTimestamp
      const serverChanges = await db.query(`
        SELECT 'todo' as type, id, title, description, completed, priority, due_date, updated_at
        FROM todos 
        WHERE user_id = $1 AND updated_at > $2
        UNION ALL
        SELECT 'tag' as type, id, name, null, null, null, null, updated_at
        FROM tags 
        WHERE user_id = $1 AND updated_at > $2
        ORDER BY updated_at
      `, [userId, lastSyncTimestamp || '1970-01-01']);

      // Log การ sync
      await LogService.createLog(userId, LogService.ACTIONS.DATA_SYNCED, {
        device_id: deviceId,
        last_sync: lastSyncTimestamp,
        server_changes_count: serverChanges.rows.length,
        local_changes_count: localChanges.length,
        timestamp: new Date().toISOString()
      });

      return {
        server_changes: serverChanges.rows,
        sync_timestamp: new Date().toISOString(),
        device_id: deviceId
      };
    } catch (error) {
      console.error('Error in syncData:', error);
      throw error;
    }
  }

  // ดึงประวัติการเปลี่ยนแปลงของข้อมูล
  static async getDataHistory(userId, dataType, dataId, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      const history = await db.query(`
        SELECT action, data, created_at
        FROM logs 
        WHERE user_id = $1 
          AND data->>'${dataType}_id' = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `, [userId, dataId, limit, offset]);

      const total = await db.query(`
        SELECT COUNT(*) 
        FROM logs 
        WHERE user_id = $1 
          AND data->>'${dataType}_id' = $2
      `, [userId, dataId]);

      return {
        records: history.rows,
        total: parseInt(total.rows[0].count)
      };
    } catch (error) {
      console.error('Error in getDataHistory:', error);
      throw error;
    }
  }

  // Helper methods
  static convertToCSV(data) {
    // Implementation for CSV conversion
    return 'CSV conversion not implemented yet';
  }

  static parseCSV(csvData) {
    // Implementation for CSV parsing
    throw new Error('CSV parsing not implemented yet');
  }

  static validateImportData(data) {
    // Implementation for data validation
    return { valid: true, errors: [] };
  }
}

module.exports = UserDataService;
