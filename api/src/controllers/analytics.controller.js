const AnalyticsService = require('../services/analytics.service');
const LogService = require('../services/log.service');

class AnalyticsController {
  // GET /api/analytics/dashboard - ดึงข้อมูล dashboard overview
  static async getDashboardOverview(req, res) {
    try {
      const userId = req.user.id;
      const overview = await AnalyticsService.getDashboardOverview(userId);

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      console.error('Error in getDashboardOverview:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_dashboard_overview',
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

  // GET /api/analytics/todos/stats - สถิติ todos ของ user
  static async getTodoStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await AnalyticsService.getUserTodoStats(userId);

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

  // GET /api/analytics/todos/priority - สถิติตาม priority
  static async getTodosByPriority(req, res) {
    try {
      const userId = req.user.id;
      const priorityStats = await AnalyticsService.getTodosByPriority(userId);

      res.json({
        success: true,
        data: priorityStats
      });
    } catch (error) {
      console.error('Error in getTodosByPriority:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todos_by_priority',
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

  // GET /api/analytics/todos/trend - แนวโน้มการสร้าง todos
  static async getTodosCreatedTrend(req, res) {
    try {
      const userId = req.user.id;
      const { days = 7 } = req.query;
      
      const trend = await AnalyticsService.getTodosCreatedTrend(userId, parseInt(days));

      res.json({
        success: true,
        data: trend,
        meta: {
          period_days: parseInt(days)
        }
      });
    } catch (error) {
      console.error('Error in getTodosCreatedTrend:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todos_created_trend',
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

  // GET /api/analytics/tags/popular - tags ที่ใช้บ่อยที่สุด
  static async getPopularTags(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;
      
      const popularTags = await AnalyticsService.getPopularTags(userId, parseInt(limit));

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

  // GET /api/analytics/activity - สถิติการใช้งานระบบ
  static async getUserActivityStats(req, res) {
    try {
      const userId = req.user.id;
      const { days = 30 } = req.query;
      
      const activityStats = await AnalyticsService.getUserActivityStats(userId, parseInt(days));

      res.json({
        success: true,
        data: activityStats
      });
    } catch (error) {
      console.error('Error in getUserActivityStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_user_activity_stats',
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

  // GET /api/analytics/performance - เปรียบเทียบประสิทธิภาพ
  static async getPerformanceComparison(req, res) {
    try {
      const userId = req.user.id;
      const comparison = await AnalyticsService.getPerformanceComparison(userId);

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Error in getPerformanceComparison:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_performance_comparison',
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

  // GET /api/analytics/logs - ดึง activity logs ของ user
  static async getUserLogs(req, res) {
    try {
      const userId = req.user.id;
      const { 
        limit = 50, 
        offset = 0, 
        action,
        start_date,
        end_date 
      } = req.query;

      let logs;
      
      if (start_date && end_date) {
        logs = await LogService.getLogsByDateRange(
          new Date(start_date), 
          new Date(end_date), 
          userId
        );
      } else if (action) {
        logs = await LogService.getLogsByAction(action, parseInt(limit), parseInt(offset));
        // Filter by user
        logs = logs.filter(log => log.user_id === userId);
      } else {
        logs = await LogService.getUserLogs(userId, parseInt(limit), parseInt(offset));
      }

      const totalCount = await LogService.getLogsCount(userId);

      res.json({
        success: true,
        data: logs,
        meta: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Error in getUserLogs:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_user_logs',
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

  // GET /api/analytics/action-stats - สถิติการใช้งานตาม action
  static async getActionStats(req, res) {
    try {
      const userId = req.user.id;
      const actionStats = await LogService.getActionStats(userId);

      res.json({
        success: true,
        data: actionStats
      });
    } catch (error) {
      console.error('Error in getActionStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_action_stats',
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

  // GET /api/analytics/todos/trends - ดึงแนวโน้มการทำงาน
  static async getTodoTrends(req, res) {
    try {
      const userId = req.user.id;
      const { timeRange = '7d' } = req.query;
      
      const trends = await AnalyticsService.getCompletionTrends(userId, timeRange);

      res.json({
        success: true,
        data: trends,
        meta: {
          timeRange: timeRange
        }
      });
    } catch (error) {
      console.error('Error in getTodoTrends:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_todo_trends',
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

  // GET /api/analytics/todos/priority-breakdown - ดึงการแบ่งตาม priority
  static async getPriorityBreakdown(req, res) {
    try {
      const userId = req.user.id;
      
      const breakdown = await AnalyticsService.getPriorityBreakdown(userId);

      res.json({
        success: true,
        data: breakdown
      });
    } catch (error) {
      console.error('Error in getPriorityBreakdown:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_priority_breakdown',
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
}

module.exports = AnalyticsController;