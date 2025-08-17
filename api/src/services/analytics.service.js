const pool = require('../config/database');
const LogService = require('./log.service');

class AnalyticsService {
  // ดึงข้อมูลภาพรวม Dashboard
  static async getDashboardOverview(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_todos,
          COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
          COUNT(CASE WHEN is_completed = false THEN 1 END) as pending_todos,
          COUNT(CASE WHEN priority = 2 THEN 1 END) as high_priority,
          COUNT(CASE WHEN priority = 1 THEN 1 END) as medium_priority,
          COUNT(CASE WHEN priority = 0 THEN 1 END) as low_priority,
          COUNT(CASE WHEN due_date < NOW() AND is_completed = false THEN 1 END) as overdue
        FROM todos 
        WHERE user_id = $1
      `;
      
      const result = await pool.query(query, [userId]);
      const overview = result.rows[0];

      // คำนวณเปอร์เซ็นต์
      const totalTodos = parseInt(overview.total_todos);
      const completionRate = totalTodos > 0 ? 
        Math.round((parseInt(overview.completed_todos) / totalTodos) * 100) : 0;

      // Log การดูข้อมูล dashboard
      await LogService.createLog(userId, LogService.ACTIONS.VIEW_DASHBOARD, {
        total_todos: totalTodos,
        completion_rate: completionRate,
        timestamp: new Date().toISOString()
      });

      return {
        ...overview,
        completion_rate: completionRate,
        productivity_score: this.calculateProductivityScore(overview)
      };
    } catch (error) {
      console.error('Error in getDashboardOverview:', error);
      throw error;
    }
  }

  // คำนวณคะแนนประสิทธิภาพ
  static calculateProductivityScore(overview) {
    const total = parseInt(overview.total_todos);
    const completed = parseInt(overview.completed_todos);
    const overdue = parseInt(overview.overdue);
    
    if (total === 0) return 0;
    
    const completionRate = (completed / total) * 100;
    const overdueRate = (overdue / total) * 100;
    
    // คะแนนจาก completion rate (0-70 คะแนน)
    const completionScore = Math.min(completionRate * 0.7, 70);
    
    // หักคะแนนจาก overdue (สูงสุด -30 คะแนน)
    const overdueDeduction = Math.min(overdueRate * 0.3, 30);
    
    return Math.max(0, Math.round(completionScore - overdueDeduction));
  }

  // ดึงสถิติ todos ของ user
  static async getUserTodoStats(userId, timeRange = '30d') {
    try {
      const dateCondition = this.getDateCondition(timeRange);
      
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as created_count,
          COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_count
        FROM todos 
        WHERE user_id = $1 ${dateCondition}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      
      const result = await pool.query(query, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error in getUserTodoStats:', error);
      throw error;
    }
  }

  // ดึงการแบ่งตาม priority
  static async getPriorityBreakdown(userId) {
    try {
      const query = `
        SELECT 
          priority,
          COUNT(*) as count,
          COUNT(CASE WHEN is_completed = true THEN 1 END) as completed,
          ROUND(AVG(CASE WHEN is_completed = true THEN 
            EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 
          END), 2) as avg_completion_hours
        FROM todos 
        WHERE user_id = $1
        GROUP BY priority
        ORDER BY priority DESC
      `;
      
      const result = await pool.query(query, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error in getPriorityBreakdown:', error);
      throw error;
    }
  }

  // ดึงแนวโน้มการทำงาน
  static async getCompletionTrends(userId, timeRange = '7d') {
    try {
      const dateCondition = this.getDateCondition(timeRange);
      
      const query = `
        SELECT 
          DATE(updated_at) as date,
          COUNT(*) as completed_count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) as avg_completion_hours
        FROM todos 
        WHERE user_id = $1 
          AND is_completed = true 
          ${dateCondition.replace('created_at', 'updated_at')}
        GROUP BY DATE(updated_at)
        ORDER BY date DESC
      `;
      
      const result = await pool.query(query, [userId]);
      
      return result.rows;
    } catch (error) {
      console.error('Error in getCompletionTrends:', error);
      throw error;
    }
  }

  // ดึง popular tags
  static async getPopularTags(userId, limit = 10) {
    try {
      const query = `
        SELECT 
          t.id,
          t.name,
          COUNT(tt.todo_id) as usage_count,
          COUNT(CASE WHEN td.is_completed = true THEN 1 END) as completed_todos
        FROM tags t
        LEFT JOIN todo_tags tt ON t.id = tt.tag_id
        LEFT JOIN todos td ON tt.todo_id = td.id
        WHERE t.user_id = $1
        GROUP BY t.id, t.name
        HAVING COUNT(tt.todo_id) > 0
        ORDER BY usage_count DESC
        LIMIT $2
      `;
      
      const result = await pool.query(query, [userId, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Error in getPopularTags:', error);
      throw error;
    }
  }

  // ดึงสถิติกิจกรรมผู้ใช้
  static async getUserActivityStats(userId, timeRange = '30d') {
    try {
      const dateCondition = this.getDateCondition(timeRange);
      
      const query = `
        SELECT 
          action,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM logs 
        WHERE user_id = $1 ${dateCondition}
        GROUP BY action, DATE(created_at)
        ORDER BY date DESC, count DESC
      `;
      
      const result = await pool.query(query, [userId]);
      
      // จัดกลุ่มตาม action
      const activitySummary = result.rows.reduce((acc, row) => {
        if (!acc[row.action]) {
          acc[row.action] = 0;
        }
        acc[row.action] += parseInt(row.count);
        return acc;
      }, {});
      
      return {
        summary: activitySummary,
        daily: result.rows
      };
    } catch (error) {
      console.error('Error in getUserActivityStats:', error);
      throw error;
    }
  }

  // เปรียบเทียบประสิทธิภาพ
  static async getPerformanceComparison(userId, compareWith = 'previous_period') {
    try {
      const currentPeriodQuery = `
        SELECT 
          COUNT(*) as total_todos,
          COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
          AVG(CASE WHEN is_completed = true THEN 
            EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 
          END) as avg_completion_hours
        FROM todos 
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
      `;
      
      const previousPeriodQuery = `
        SELECT 
          COUNT(*) as total_todos,
          COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
          AVG(CASE WHEN is_completed = true THEN 
            EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 
          END) as avg_completion_hours
        FROM todos 
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '60 days'
          AND created_at < NOW() - INTERVAL '30 days'
      `;
      
      const [currentResult, previousResult] = await Promise.all([
        pool.query(currentPeriodQuery, [userId]),
        pool.query(previousPeriodQuery, [userId])
      ]);
      
      const current = currentResult.rows[0];
      const previous = previousResult.rows[0];
      
      // คำนวณเปอร์เซ็นต์การเปลี่ยนแปลง
      const calculateChange = (current, previous) => {
        if (!previous || previous === 0) return 0;
        return Math.round(((current - previous) / previous) * 100);
      };
      
      return {
        current_period: current,
        previous_period: previous,
        changes: {
          total_todos: calculateChange(current.total_todos, previous.total_todos),
          completed_todos: calculateChange(current.completed_todos, previous.completed_todos),
          avg_completion_hours: calculateChange(current.avg_completion_hours, previous.avg_completion_hours)
        }
      };
    } catch (error) {
      console.error('Error in getPerformanceComparison:', error);
      throw error;
    }
  }

  // ดึง logs ของ user
  static async getUserLogs(userId, filters = {}, limit = 50, offset = 0) {
    try {
      let query = `
        SELECT 
          id,
          action,
          details,
          created_at
        FROM logs 
        WHERE user_id = $1
      `;
      
      const queryParams = [userId];
      let paramCount = 1;
      
      // เพิ่ม filters
      if (filters.action) {
        paramCount++;
        query += ` AND action = $${paramCount}`;
        queryParams.push(filters.action);
      }
      
      if (filters.startDate) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        queryParams.push(filters.startDate);
      }
      
      if (filters.endDate) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        queryParams.push(filters.endDate);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      queryParams.push(limit, offset);
      
      const result = await pool.query(query, queryParams);
      
      // นับจำนวนทั้งหมด
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM logs 
        WHERE user_id = $1
        ${filters.action ? ' AND action = $2' : ''}
        ${filters.startDate ? ` AND created_at >= $${filters.action ? 3 : 2}` : ''}
        ${filters.endDate ? ` AND created_at <= $${filters.action ? (filters.startDate ? 4 : 3) : (filters.startDate ? 3 : 2)}` : ''}
      `;
      
      const countParams = [userId];
      if (filters.action) countParams.push(filters.action);
      if (filters.startDate) countParams.push(filters.startDate);
      if (filters.endDate) countParams.push(filters.endDate);
      
      const countResult = await pool.query(countQuery, countParams);
      
      return {
        logs: result.rows,
        total: parseInt(countResult.rows[0].total)
      };
    } catch (error) {
      console.error('Error in getUserLogs:', error);
      throw error;
    }
  }

  // Helper function สำหรับ date condition
  static getDateCondition(timeRange) {
    switch (timeRange) {
      case '7d':
        return 'AND created_at >= NOW() - INTERVAL \'7 days\'';
      case '30d':
        return 'AND created_at >= NOW() - INTERVAL \'30 days\'';
      case '90d':
        return 'AND created_at >= NOW() - INTERVAL \'90 days\'';
      case '1y':
        return 'AND created_at >= NOW() - INTERVAL \'1 year\'';
      default:
        return 'AND created_at >= NOW() - INTERVAL \'30 days\'';
    }
  }
}

module.exports = AnalyticsService;
