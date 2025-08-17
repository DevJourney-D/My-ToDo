const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthService {
  // สร้าง JWT token
  generateToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // ลงทะเบียนผู้ใช้ใหม่
  async register(userData) {
    const { username, email, password } = userData;

    // ตรวจสอบว่า email ถูกใช้แล้วหรือไม่
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว');
    }

    // เข้ารหัสรหัสผ่าน
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // บันทึกผู้ใช้ใหม่
    const result = await db.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    };
  }

  // เข้าสู่ระบบ
  async login(credentials) {
    const { email, password } = credentials;

    // ค้นหาผู้ใช้
    const result = await db.query(
      'SELECT id, username, email, password, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const user = result.rows[0];

    // ตรวจสอบรหัสผ่าน
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at
      },
      token
    };
  }

  // ตรวจสอบ token
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ตรวจสอบว่า user ยังมีอยู่ในระบบ
      const result = await db.query(
        'SELECT id, username, email, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('ผู้ใช้ไม่พบในระบบ');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error('Token ไม่ถูกต้อง');
    }
  }

  // อัพเดทโปรไฟล์ผู้ใช้
  async updateProfile(userId, updateData) {
    const { username, email } = updateData;
    
    // ตรวจสอบว่า email หรือ username ไม่ซ้ำกับคนอื่น
    const existingUser = await db.query(
      'SELECT id FROM users WHERE (email = $1 OR username = $2) AND id != $3',
      [email, username, userId]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว');
    }

    const result = await db.query(
      'UPDATE users SET username = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, username, email, created_at, updated_at',
      [username, email, userId]
    );

    return result.rows[0];
  }

  // เปลี่ยนรหัสผ่าน
  async changePassword(userId, passwordData) {
    const { currentPassword, newPassword } = passwordData;

    // ดึงรหัสผ่านปัจจุบัน
    const userResult = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('ไม่พบผู้ใช้');
    }

    // ตรวจสอบรหัสผ่านปัจจุบัน
    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isValidPassword) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    // เข้ารหัสรหัสผ่านใหม่
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // อัพเดทรหัสผ่าน
    await db.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, userId]
    );

    return { message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
  }
}

module.exports = new AuthService();
