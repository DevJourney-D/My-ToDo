const UserDataService = require('../services/userData.service');
const LogService = require('../services/log.service');

class UserDataController {
  // GET /api/user-data/backup - สร้างและดาวน์โหลด backup
  static async createBackup(req, res) {
    try {
      const userId = req.user.id;
      const { format = 'json', includeMetadata = true } = req.query;

      const backupData = await UserDataService.createBackup(userId, {
        format,
        includeMetadata: includeMetadata === 'true'
      });

      // Set appropriate headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `backup-${userId}-${timestamp}.${format}`;
      
      res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (format === 'json') {
        res.json(backupData);
      } else {
        res.send(backupData);
      }
    } catch (error) {
      console.error('Error in createBackup:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'create_backup',
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

  // POST /api/user-data/restore - คืนค่าข้อมูลจาก backup
  static async restoreFromBackup(req, res) {
    try {
      const userId = req.user.id;
      const { backupData, options = {} } = req.body;

      if (!backupData) {
        return res.status(400).json({
          success: false,
          message: 'Backup data is required'
        });
      }

      const result = await UserDataService.restoreFromBackup(userId, backupData, options);

      res.json({
        success: true,
        message: 'Data restored successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in restoreFromBackup:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'restore_from_backup',
        error: error.message,
        input_size: req.body?.backupData ? JSON.stringify(req.body.backupData).length : 0,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('Invalid backup data') ? 400 : 500).json({
        success: false,
        message: error.message.includes('Invalid backup data') 
          ? 'Invalid backup data format' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/user-data/export - ส่งออกข้อมูลในรูปแบบต่างๆ
  static async exportData(req, res) {
    try {
      const userId = req.user.id;
      const { 
        format = 'json',
        dataTypes = 'all',
        dateRange,
        compress = false
      } = req.query;

      const exportOptions = {
        format,
        dataTypes: dataTypes === 'all' ? ['todos', 'tags', 'logs'] : dataTypes.split(','),
        dateRange: dateRange ? JSON.parse(dateRange) : null,
        compress: compress === 'true'
      };

      const exportedData = await UserDataService.exportData(userId, exportOptions);

      // Set headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `export-${userId}-${timestamp}.${format}${compress ? '.gz' : ''}`;
      
      res.setHeader('Content-Type', compress ? 'application/gzip' : 
                   format === 'json' ? 'application/json' : 
                   format === 'csv' ? 'text/csv' : 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (compress) {
        res.send(exportedData);
      } else if (format === 'json') {
        res.json(exportedData);
      } else {
        res.send(exportedData);
      }
    } catch (error) {
      console.error('Error in exportData:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'export_data',
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

  // POST /api/user-data/import - นำเข้าข้อมูลจากไฟล์
  static async importData(req, res) {
    try {
      const userId = req.user.id;
      const { 
        data, 
        format = 'json',
        options = {} 
      } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          message: 'Import data is required'
        });
      }

      const result = await UserDataService.importData(userId, data, format, options);

      res.json({
        success: true,
        message: 'Data imported successfully',
        data: result
      });
    } catch (error) {
      console.error('Error in importData:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'import_data',
        error: error.message,
        data_size: req.body?.data ? JSON.stringify(req.body.data).length : 0,
        format: req.body?.format,
        timestamp: new Date().toISOString()
      });

      res.status(error.message.includes('Invalid') ? 400 : 500).json({
        success: false,
        message: error.message.includes('Invalid') 
          ? 'Invalid import data format' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/user-data/statistics - สถิติการใช้งานข้อมูล
  static async getDataStatistics(req, res) {
    try {
      const userId = req.user.id;
      const stats = await UserDataService.getDataStatistics(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getDataStatistics:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_data_statistics',
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

  // DELETE /api/user-data/cleanup - ทำความสะอาดข้อมูล
  static async cleanupData(req, res) {
    try {
      const userId = req.user.id;
      const { 
        olderThan = 90, // วัน
        dataTypes = ['logs'],
        dryRun = false 
      } = req.body;

      const result = await UserDataService.cleanupOldData(userId, {
        olderThan,
        dataTypes,
        dryRun
      });

      res.json({
        success: true,
        message: dryRun ? 'Cleanup preview completed' : 'Data cleanup completed',
        data: result
      });
    } catch (error) {
      console.error('Error in cleanupData:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'cleanup_data',
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

  // GET /api/user-data/integrity - ตรวจสอบความสมบูรณ์ของข้อมูล
  static async checkDataIntegrity(req, res) {
    try {
      const userId = req.user.id;
      const integrityReport = await UserDataService.checkDataIntegrity(userId);

      res.json({
        success: true,
        data: integrityReport
      });
    } catch (error) {
      console.error('Error in checkDataIntegrity:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'check_data_integrity',
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

  // POST /api/user-data/sync - ซิงค์ข้อมูลระหว่าง devices
  static async syncData(req, res) {
    try {
      const userId = req.user.id;
      const { 
        deviceId,
        lastSyncTimestamp,
        localChanges = []
      } = req.body;

      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required'
        });
      }

      const syncResult = await UserDataService.syncData(userId, {
        deviceId,
        lastSyncTimestamp,
        localChanges
      });

      res.json({
        success: true,
        message: 'Data sync completed',
        data: syncResult
      });
    } catch (error) {
      console.error('Error in syncData:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'sync_data',
        error: error.message,
        device_id: req.body?.deviceId,
        changes_count: req.body?.localChanges?.length || 0,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/user-data/history/:dataType/:id - ดึงประวัติการเปลี่ยนแปลงของข้อมูล
  static async getDataHistory(req, res) {
    try {
      const userId = req.user.id;
      const { dataType, id } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const history = await UserDataService.getDataHistory(userId, dataType, id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.json({
        success: true,
        data: history.records,
        meta: {
          total: history.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: history.total > (parseInt(offset) + parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error in getDataHistory:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_data_history',
        data_type: req.params.dataType,
        data_id: req.params.id,
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

module.exports = UserDataController;
