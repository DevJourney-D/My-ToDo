const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const LogService = require('./log.service');
const XLSX = require('xlsx');

class UserService {
  // สร้าง user ใหม่
  static async createUser(username, password) {
    try {
      // เช็คว่า username ซ้ำหรือไม่
      const existingUser = await this.getUserByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const query = `
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING id, username, created_at
      `;
      
      const values = [username, passwordHash];
      const result = await db.query(query, values);
      
      const newUser = result.rows[0];
      
      // Log การสร้าง user
      await LogService.createLog(newUser.id, LogService.ACTIONS.USER_REGISTER, {
        username: username,
        registration_time: new Date().toISOString()
      });
      
      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // ดึงข้อมูล user ตาม username
  static async getUserByUsername(username) {
    try {
      const query = 'SELECT * FROM users WHERE username = $1';
      const result = await db.query(query, [username]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  // ดึงข้อมูล user ตาม ID
  static async getUserById(id) {
    try {
      const query = 'SELECT id, username, created_at FROM users WHERE id = $1';
      const result = await db.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  // ตรวจสอบ password
  static async validatePassword(username, password) {
    try {
      const user = await this.getUserByUsername(username);
      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return null;
      }

      // Log การ login
      await LogService.createLog(user.id, LogService.ACTIONS.USER_LOGIN, {
        username: username,
        login_time: new Date().toISOString(),
        ip_address: null // จะเพิ่มใน controller
      });

      return {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      };
    } catch (error) {
      console.error('Error validating password:', error);
      throw error;
    }
  }

  // สร้าง JWT token
  static generateToken(user) {
    try {
      const payload = {
        id: user.id,
        username: user.username
      };

      const options = {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
      };

      return jwt.sign(payload, process.env.JWT_SECRET, options);
    } catch (error) {
      console.error('Error generating token:', error);
      throw error;
    }
  }

  // ตรวจสอบ JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error('Error verifying token:', error);
      throw error;
    }
  }

  // อัพเดตข้อมูล user
  static async updateUser(id, updates) {
    try {
      const allowedUpdates = ['username'];
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

      // สร้าง dynamic query
      const setClause = Object.keys(filteredUpdates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const query = `
        UPDATE users 
        SET ${setClause}
        WHERE id = $1
        RETURNING id, username, created_at
      `;

      const values = [id, ...Object.values(filteredUpdates)];
      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const updatedUser = result.rows[0];

      // Log การอัพเดต
      await LogService.createLog(id, LogService.ACTIONS.USER_UPDATE_PROFILE, {
        updated_fields: Object.keys(filteredUpdates),
        update_time: new Date().toISOString()
      });

      return updatedUser;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // เปลี่ยน password
  static async changePassword(id, currentPassword, newPassword) {
    try {
      // ดึงข้อมูล user ปัจจุบัน
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      // ตรวจสอบ password ปัจจุบัน
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash password ใหม่
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // อัพเดต password
      const updateQuery = `
        UPDATE users 
        SET password_hash = $1
        WHERE id = $2
        RETURNING id, username, created_at
      `;

      const updateResult = await db.query(updateQuery, [newPasswordHash, id]);

      // Log การเปลี่ยน password
      await LogService.createLog(id, LogService.ACTIONS.USER_UPDATE_PROFILE, {
        action: 'password_change',
        change_time: new Date().toISOString()
      });

      return updateResult.rows[0];
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  // ลบ user (soft delete หรือ hard delete)
  static async deleteUser(id) {
    try {
      // ลบ todos ของ user ก่อน
      await db.query('DELETE FROM todos WHERE user_id = $1', [id]);
      
      // ลบ tags ของ user
      await db.query('DELETE FROM tags WHERE user_id = $1', [id]);
      
      // ลบ user
      const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
      const result = await db.query(query, [id]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Log การลบ user
      await LogService.createLog(id, LogService.ACTIONS.USER_DELETE, {
        deleted_time: new Date().toISOString()
      });

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  // ดึงสถิติ user
  static async getUserStats(id) {
    try {
      const query = `
        SELECT 
          u.id,
          u.username,
          u.created_at,
          COUNT(t.id) as total_todos,
          COUNT(CASE WHEN t.is_completed = true THEN 1 END) as completed_todos,
          COUNT(DISTINCT tag.id) as total_tags
        FROM users u
        LEFT JOIN todos t ON u.id = t.user_id
        LEFT JOIN tags tag ON u.id = tag.user_id
        WHERE u.id = $1
        GROUP BY u.id, u.username, u.created_at
      `;

      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const stats = result.rows[0];
      
      return {
        id: stats.id,
        username: stats.username,
        created_at: stats.created_at,
        total_todos: parseInt(stats.total_todos),
        completed_todos: parseInt(stats.completed_todos),
        pending_todos: parseInt(stats.total_todos) - parseInt(stats.completed_todos),
        total_tags: parseInt(stats.total_tags),
        completion_rate: stats.total_todos > 0 
          ? (stats.completed_todos / stats.total_todos * 100).toFixed(2)
          : 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Log logout
  static async logoutUser(userId) {
    try {
      await LogService.createLog(userId, LogService.ACTIONS.USER_LOGOUT, {
        logout_time: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging logout:', error);
      throw error;
    }
  }

  // Export user data to Excel
  static async exportUserData(userId) {
    try {
      // ดึงข้อมูล user
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // ดึงข้อมูล todos ของ user
      const todosQuery = `
        SELECT 
          t.id,
          t.text,
          t.is_completed,
          t.priority,
          t.due_date,
          t.created_at,
          STRING_AGG(tag.name, ', ') as tags
        FROM todos t
        LEFT JOIN todo_tags tt ON t.id = tt.todo_id
        LEFT JOIN tags tag ON tt.tag_id = tag.id
        WHERE t.user_id = $1
        GROUP BY t.id, t.text, t.is_completed, t.priority, t.due_date, t.created_at
        ORDER BY t.created_at DESC
      `;
      
      const todosResult = await db.query(todosQuery, [userId]);
      
      // ดึงข้อมูล tags ของ user
      const tagsQuery = `
        SELECT DISTINCT tag.name, COUNT(tt.todo_id) as todo_count
        FROM tags tag
        LEFT JOIN todo_tags tt ON tag.id = tt.tag_id
        LEFT JOIN todos t ON tt.todo_id = t.id AND t.user_id = $1
        WHERE tag.user_id = $1
        GROUP BY tag.id, tag.name
        ORDER BY tag.name
      `;
      
      const tagsResult = await db.query(tagsQuery, [userId]);

      // ดึงสถิติผู้ใช้
      const stats = await this.getUserStats(userId);

      // เตรียมข้อมูลสำหรับ Excel
      const userInfo = [{
        'ชื่อผู้ใช้': user.username,
        'วันที่สมัคร': user.created_at,
        'จำนวนงานทั้งหมด': stats.total_todos,
        'งานที่เสร็จแล้ว': stats.completed_todos,
        'งานที่ค้างอยู่': stats.pending_todos,
        'อัตราการทำงานเสร็จ (%)': stats.completion_rate,
        'จำนวน Tags': stats.total_tags,
        'วันที่ส่งออกข้อมูล': new Date().toLocaleString('th-TH')
      }];

      const todoData = todosResult.rows.map(todo => ({
        'รหัสงาน': todo.id,
        'ชื่องาน': todo.text,
        'สถานะ': todo.is_completed ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ',
        'ความสำคัญ': todo.priority === 1 ? 'สูง' : todo.priority === 2 ? 'กลาง' : 'ต่ำ',
        'วันครบกำหนด': todo.due_date || '',
        'วันที่สร้าง': todo.created_at,
        'Tags': todo.tags || ''
      }));

      const tagData = tagsResult.rows.map(tag => ({
        'ชื่อ Tag': tag.name,
        'จำนวนงานที่ใช้': tag.todo_count
      }));

      // สร้าง workbook
      const workbook = XLSX.utils.book_new();
      
      // เพิ่ม worksheets
      const userInfoSheet = XLSX.utils.json_to_sheet(userInfo);
      const todoSheet = XLSX.utils.json_to_sheet(todoData);
      const tagSheet = XLSX.utils.json_to_sheet(tagData);
      
      XLSX.utils.book_append_sheet(workbook, userInfoSheet, 'ข้อมูลผู้ใช้');
      XLSX.utils.book_append_sheet(workbook, todoSheet, 'รายการงาน');
      XLSX.utils.book_append_sheet(workbook, tagSheet, 'Tags');

      // สร้าง buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Log การ export
      await LogService.createLog(userId, LogService.ACTIONS.USER_EXPORT_DATA, {
        export_time: new Date().toISOString(),
        export_format: 'xlsx',
        todos_count: todoData.length,
        tags_count: tagData.length
      });

      return {
        buffer,
        filename: `user_data_${user.username}_${new Date().toISOString().split('T')[0]}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }
}

module.exports = UserService;
