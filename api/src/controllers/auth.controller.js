const UserService = require('../services/user.service');
const LogService = require('../services/log.service');

class AuthController {
  // POST /api/auth/register - สมัครสมาชิก
  static async register(req, res) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      if (username.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Username must be at least 3 characters long'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const user = await UserService.createUser(username, password);
      const token = UserService.generateToken(user);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            created_at: user.created_at
          },
          token
        }
      });
    } catch (error) {
      console.error('Error in register:', error);
      
      // Log error (ไม่ระบุ user_id เพราะยังไม่ได้ register)
      await LogService.createLog(null, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'register',
        error: error.message,
        username: req.body?.username,
        timestamp: new Date().toISOString()
      });

      res.status(error.message === 'Username already exists' ? 409 : 500).json({
        success: false,
        message: error.message === 'Username already exists' 
          ? 'Username already exists' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/auth/login - เข้าสู่ระบบ
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      const user = await UserService.validatePassword(username, password);
      
      if (!user) {
        // Log failed login attempt
        await LogService.createLog(null, LogService.ACTIONS.SYSTEM_WARNING, {
          action: 'failed_login',
          username: username,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }

      const token = UserService.generateToken(user);

      // Update log with IP address (re-log with user ID)
      await LogService.createLog(user.id, LogService.ACTIONS.USER_LOGIN, {
        username: username,
        login_time: new Date().toISOString(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            created_at: user.created_at
          },
          token
        }
      });
    } catch (error) {
      console.error('Error in login:', error);
      
      await LogService.createLog(null, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'login',
        error: error.message,
        username: req.body?.username,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/auth/logout - ออกจากระบบ
  static async logout(req, res) {
    try {
      const userId = req.user?.id;

      if (userId) {
        await UserService.logoutUser(userId);
      }

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Error in logout:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'logout',
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

  // GET /api/auth/me - ดึงข้อมูล user ปัจจุบัน
  static async getCurrentUser(req, res) {
    try {
      const userId = req.user.id;
      const user = await UserService.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            created_at: user.created_at
          }
        }
      });
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_current_user',
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

  // POST /api/auth/change-password - เปลี่ยน password
  static async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      // Validation
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

      const updatedUser = await UserService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully',
        data: {
          user: {
            id: updatedUser.id,
            username: updatedUser.username,
            created_at: updatedUser.created_at
          }
        }
      });
    } catch (error) {
      console.error('Error in changePassword:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'change_password',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      const status = error.message === 'Current password is incorrect' ? 400 : 500;
      res.status(status).json({
        success: false,
        message: error.message === 'Current password is incorrect' 
          ? 'Current password is incorrect' 
          : 'Internal server error',
        error: error.message
      });
    }
  }

  // GET /api/auth/stats - ดึงสถิติ user
  static async getUserStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await UserService.getUserStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getUserStats:', error);
      
      await LogService.createLog(req.user?.id, LogService.ACTIONS.SYSTEM_ERROR, {
        action: 'get_user_stats',
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

  // POST /api/auth/refresh - รีเฟรช token
  static async refreshToken(req, res) {
    try {
      // Placeholder for refresh token functionality
      res.status(501).json({
        success: false,
        message: 'Refresh token functionality not implemented yet'
      });
    } catch (error) {
      console.error('Error in refreshToken:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/auth/verify-email - ยืนยันอีเมล
  static async verifyEmail(req, res) {
    try {
      // Placeholder for email verification functionality
      res.status(501).json({
        success: false,
        message: 'Email verification functionality not implemented yet'
      });
    } catch (error) {
      console.error('Error in verifyEmail:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/auth/forgot-password - ลืมรหัสผ่าน
  static async forgotPassword(req, res) {
    try {
      // Placeholder for forgot password functionality
      res.status(501).json({
        success: false,
        message: 'Forgot password functionality not implemented yet'
      });
    } catch (error) {
      console.error('Error in forgotPassword:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // POST /api/auth/reset-password - รีเซ็ตรหัสผ่าน
  static async resetPassword(req, res) {
    try {
      // Placeholder for reset password functionality
      res.status(501).json({
        success: false,
        message: 'Reset password functionality not implemented yet'
      });
    } catch (error) {
      console.error('Error in resetPassword:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = AuthController;