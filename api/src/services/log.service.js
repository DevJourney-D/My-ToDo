const db = require('../config/database');

class LogService {
  // เก็บ log การทำงานของระบบ
  static async createLog(userId, action, details = null) {
    try {
      const query = `
        INSERT INTO logs (user_id, action, details, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      
      const values = [userId, action, details];
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating log:', error);
      throw error;
    }
  }

  // ดึง logs ทั้งหมดของ user
  static async getUserLogs(userId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT l.*, u.username
        FROM logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.user_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const values = [userId, limit, offset];
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting user logs:', error);
      throw error;
    }
  }

  // ดึง logs ทั้งหมดของระบบ (สำหรับ admin)
  static async getAllLogs(limit = 100, offset = 0) {
    try {
      const query = `
        SELECT l.*, u.username
        FROM logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const values = [limit, offset];
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting all logs:', error);
      throw error;
    }
  }

  // ดึง logs ตาม action
  static async getLogsByAction(action, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT l.*, u.username
        FROM logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.action = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const values = [action, limit, offset];
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting logs by action:', error);
      throw error;
    }
  }

  // ดึง logs ตามช่วงเวลา
  static async getLogsByDateRange(startDate, endDate, userId = null) {
    try {
      let query = `
        SELECT l.*, u.username
        FROM logs l
        LEFT JOIN users u ON l.user_id = u.id
        WHERE l.created_at >= $1 AND l.created_at <= $2
      `;
      
      const values = [startDate, endDate];
      
      if (userId) {
        query += ' AND l.user_id = $3';
        values.push(userId);
      }
      
      query += ' ORDER BY l.created_at DESC';
      
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting logs by date range:', error);
      throw error;
    }
  }

  // นับจำนวน logs
  static async getLogsCount(userId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM logs';
      const values = [];
      
      if (userId) {
        query += ' WHERE user_id = $1';
        values.push(userId);
      }
      
      const result = await db.query(query, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting logs count:', error);
      throw error;
    }
  }

  // สถิติการใช้งานตาม action
  static async getActionStats(userId = null) {
    try {
      let query = `
        SELECT action, COUNT(*) as count
        FROM logs
      `;
      
      const values = [];
      
      if (userId) {
        query += ' WHERE user_id = $1';
        values.push(userId);
      }
      
      query += ' GROUP BY action ORDER BY count DESC';
      
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting action stats:', error);
      throw error;
    }
  }

  // ลบ logs เก่า (สำหรับ cleanup)
  static async cleanupOldLogs(daysToKeep = 90) {
    try {
      const query = `
        DELETE FROM logs 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING COUNT(*)
      `;
      
      const result = await db.query(query);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw error;
    }
  }
}

// Action constants สำหรับ logging
LogService.ACTIONS = {
  // User actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  USER_UPDATE_PROFILE: 'user_update_profile',
  USER_EXPORT_DATA: 'user_export_data',
  PASSWORD_CHANGE_FAILED: 'password_change_failed',
  
  // Todo actions
  TODO_CREATE: 'todo_create',
  TODO_UPDATE: 'todo_update',
  TODO_DELETE: 'todo_delete',
  TODO_COMPLETE: 'todo_complete',
  TODO_UNCOMPLETE: 'todo_uncomplete',
  
  // Tag actions
  TAG_CREATE: 'tag_create',
  TAG_UPDATE: 'tag_update',
  TAG_DELETE: 'tag_delete',
  TAG_ASSIGN: 'tag_assign',
  TAG_UNASSIGN: 'tag_unassign',
  
  // System actions
  SYSTEM_ERROR: 'system_error',
  SYSTEM_WARNING: 'system_warning',
  SYSTEM_INFO: 'system_info',
  VIEW_DASHBOARD: 'view_dashboard'
};

module.exports = LogService;
