const LogService = require('../services/log.service');

class LogController {
  // GET /api/logs - ดึง logs
  static async getLogs(req, res) {
    try {
      const userId = req.user.id;
      const { 
        action, 
        startDate, 
        endDate, 
        limit = 50, 
        offset = 0 
      } = req.query;

      const filters = {};
      if (action) filters.action = action;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const logs = await LogService.getUserLogs(
        userId, 
        parseInt(limit), 
        parseInt(offset)
      );

      res.json({
        success: true,
        data: logs,
        meta: {
          total: logs.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: logs.total > (parseInt(offset) + parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error in getLogs:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_logs',
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

  // GET /api/logs/actions - ดึงรายการ actions ที่มีอยู่
  static async getLogActions(req, res) {
    try {
      const actions = Object.values(LogService.ACTIONS);
      
      res.json({
        success: true,
        data: actions
      });
    } catch (error) {
      console.error('Error in getLogActions:', error);
      
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/logs/stats - ดึงสถิติ logs
  static async getLogStats(req, res) {
    try {
      const userId = req.user.id;
      const { timeRange = '30d' } = req.query;
      
      const stats = await LogService.getLogStats(userId, timeRange);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getLogStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_log_stats',
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

  // GET /api/logs/export - ส่งออก logs
  static async exportLogs(req, res) {
    try {
      const userId = req.user.id;
      const { 
        format = 'json',
        startDate,
        endDate,
        action
      } = req.query;

      const filters = {};
      if (action) filters.action = action;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const logs = await LogService.exportLogs(userId, filters, format);

      // Set headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `logs-${userId}-${timestamp}.${format}`;
      
      res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (format === 'json') {
        res.json(logs);
      } else {
        res.send(logs);
      }
    } catch (error) {
      console.error('Error in exportLogs:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'export_logs',
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

  // POST /api/logs - สร้าง log ใหม่
  static async createLog(req, res) {
    try {
      const userId = req.user.id;
      const { action, details } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Action is required'
        });
      }

      const log = await LogService.createLog(userId, action, details);

      res.status(201).json({
        success: true,
        message: 'Log created successfully',
        data: log
      });
    } catch (error) {
      console.error('Error in createLog:', error);

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/logs/cleanup - ทำความสะอาด logs เก่า
  static async cleanupLogs(req, res) {
    try {
      const userId = req.user.id;
      const { olderThan = 90, dryRun = false } = req.body;

      const result = await LogService.cleanupOldLogs(userId, olderThan, dryRun);

      res.json({
        success: true,
        message: dryRun ? 'Cleanup preview completed' : 'Logs cleanup completed',
        data: result
      });
    } catch (error) {
      console.error('Error in cleanupLogs:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'cleanup_logs',
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

  // DELETE /api/logs/bulk - ลบ logs หลายรายการ
  static async bulkDeleteLogs(req, res) {
    try {
      const userId = req.user.id;
      const { logIds, filters } = req.body;

      if (!logIds && !filters) {
        return res.status(400).json({
          success: false,
          message: 'Log IDs or filters are required'
        });
      }

      let result;
      if (logIds && Array.isArray(logIds)) {
        result = await LogService.bulkDeleteLogs(userId, logIds);
      } else if (filters) {
        result = await LogService.deleteLogsByFilters(userId, filters);
      }

      res.json({
        success: true,
        message: 'Logs deleted successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in bulkDeleteLogs:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'bulk_delete_logs',
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
}

module.exports = LogController;
