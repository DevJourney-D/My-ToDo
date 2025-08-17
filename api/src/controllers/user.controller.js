const UserService = require('../services/user.service');
const LogService = require('../services/log.service');

class UserController {
  // GET /api/user/profile - ดึงข้อมูล profile
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;
      
      const profile = await UserService.getUserById(userId);
      
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error in getProfile:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_profile',
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

  // PUT /api/user/profile - อัพเดท profile
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updates = req.body;

      // ป้องกันการอัพเดท sensitive fields
      const allowedFields = ['name', 'email'];
      const sanitizedUpdates = {};
      
      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field];
        }
      });

      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update'
        });
      }

      const updatedUser = await UserService.updateProfile(userId, sanitizedUpdates);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Error in updateProfile:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_profile',
        error: error.message,
        input_data: req.body,
        timestamp: new Date().toISOString()
      });

      const status = error.message.includes('Email already exists') ? 409 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message.includes('Email already exists') 
          ? 'Email already exists' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // PUT /api/user/password - เปลี่ยนรหัสผ่าน
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      const result = await UserService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Error in changePassword:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.PASSWORD_CHANGE_FAILED, {
        action: 'change_password',
        error: error.message,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      const status = error.message.includes('Current password is incorrect') ? 400 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message.includes('Current password is incorrect') 
          ? 'Current password is incorrect' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/user/statistics - ดึงสถิติของ user
  static async getUserStatistics(req, res) {
    try {
      const userId = req.user.id;
      const stats = await UserService.getUserStatistics(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getUserStatistics:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_user_statistics',
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

  // GET /api/user/activity - ดึงประวัติการใช้งาน
  static async getUserActivity(req, res) {
    try {
      const userId = req.user.id;
      const { 
        startDate, 
        endDate, 
        action, 
        limit = 50, 
        offset = 0 
      } = req.query;

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (action) filters.action = action;

      const activity = await UserService.getUserActivity(
        userId, 
        filters, 
        parseInt(limit), 
        parseInt(offset)
      );

      res.json({
        success: true,
        data: activity.logs,
        meta: {
          total: activity.total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: activity.total > (parseInt(offset) + parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error in getUserActivity:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_user_activity',
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

  // DELETE /api/user/account - ลบบัญชีผู้ใช้
  static async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Password is required to delete account'
        });
      }

      const result = await UserService.deleteAccount(userId, password);

      res.json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteAccount:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'delete_account',
        error: error.message,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      const status = error.message.includes('Password is incorrect') ? 400 : 500;
      
      res.status(status).json({
        success: false,
        message: error.message.includes('Password is incorrect') 
          ? 'Password is incorrect' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/user/preferences - ดึงการตั้งค่า
  static async getPreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferences = await UserService.getUserPreferences(userId);

      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Error in getPreferences:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_preferences',
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

  // PUT /api/user/preferences - อัพเดทการตั้งค่า
  static async updatePreferences(req, res) {
    try {
      const userId = req.user.id;
      const preferences = req.body;

      const updatedPreferences = await UserService.updateUserPreferences(userId, preferences);

      res.json({
        success: true,
        message: 'Preferences updated successfully',
        data: updatedPreferences
      });
    } catch (error) {
      console.error('Error in updatePreferences:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'update_preferences',
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

  // GET /api/user/export - ส่งออกข้อมูล
  static async exportUserData(req, res) {
    try {
      const userId = req.user.id;
      const { format = 'xlsx' } = req.query;

      if (format === 'xlsx') {
        const { buffer, filename, contentType } = await UserService.exportUserData(userId);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
      } else if (format === 'json') {
        // สำหรับ JSON ต้องสร้างข้อมูลแยก (ไม่ได้ใช้ฟังก์ชัน exportUserData)
        const user = await UserService.getUserById(userId);
        const stats = await UserService.getUserStats(userId);
        
        const userData = {
          user_info: {
            id: user.id,
            username: user.username,
            created_at: user.created_at
          },
          statistics: stats,
          exported_at: new Date().toISOString()
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);
        res.json(userData);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Supported formats: xlsx, json'
        });
      }
    } catch (error) {
      console.error('Error in exportUserData:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'export_user_data',
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
}

module.exports = UserController;
