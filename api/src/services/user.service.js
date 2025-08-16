const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * บันทึก log ลงฐานข้อมูล
 */
const createLog = async (userId, action, details) => {
  try {
    const query = `
      INSERT INTO public.logs (user_id, action, details, created_at)
      VALUES ($1, $2, $3, NOW())
    `;
    await pool.query(query, [userId, action, JSON.stringify(details)]);
  } catch (error) {
    console.error('Error creating log:', error);
  }
};

/**
 * สร้างผู้ใช้ใหม่ในระบบ
 */
const register = async (userData) => {
  const { username, password } = userData;

  try {
    // 1. เข้ารหัสรหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 2. บันทึกผู้ใช้ลงฐานข้อมูล
    const query = `
      INSERT INTO public.users (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at;
    `;
    const values = [username, passwordHash];

    const result = await pool.query(query, values);
    const newUser = result.rows[0];

    // 3. บันทึก log สำเร็จ
    await createLog(newUser.id, 'REGISTER_SUCCESS', {
      username: username,
      timestamp: new Date().toISOString()
    });

    return newUser;
  } catch (error) {
    // บันทึก log ล้มเหลว
    await createLog(null, 'REGISTER_FAIL', {
      username: username,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ตรวจสอบข้อมูลและเข้าสู่ระบบ
 */
const login = async (credentials) => {
  const { username, password } = credentials;

  try {
    // 1. ค้นหาผู้ใช้จาก username
    const result = await pool.query('SELECT * FROM public.users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) {
      // บันทึก log ล้มเหลว - ไม่พบผู้ใช้
      await createLog(null, 'LOGIN_FAIL', {
        username: username,
        reason: 'User not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Invalid credentials');
    }

    // 2. เปรียบเทียบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // บันทึก log ล้มเหลว - รหัสผ่านไม่ถูกต้อง
      await createLog(user.id, 'LOGIN_FAIL', {
        username: username,
        reason: 'Invalid password',
        timestamp: new Date().toISOString()
      });
      throw new Error('Invalid credentials');
    }

    // 3. สร้าง JWT
    const payload = {
      id: user.id,
      username: user.username,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1d', // Token หมดอายุใน 1 วัน
    });

    // 4. บันทึก log สำเร็จ
    await createLog(user.id, 'LOGIN_SUCCESS', {
      username: username,
      timestamp: new Date().toISOString()
    });

    // ลบ password_hash ออกก่อนส่งข้อมูลกลับ
    delete user.password_hash;

    return { user, token };
  } catch (error) {
    // ถ้าไม่ได้ log ไว้แล้ว ให้ log error ทั่วไป
    if (!error.message.includes('Invalid credentials')) {
      await createLog(null, 'LOGIN_FAIL', {
        username: username,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ดึงข้อมูลผู้ใช้จาก user id
 */
const getUserInfo = async (userId) => {
  try {
    const query = 'SELECT id, username, created_at FROM public.users WHERE id = $1';
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      // บันทึก log ล้มเหลว - ไม่พบผู้ใช้
      await createLog(userId, 'GET_USER_INFO_FAIL', {
        userId: userId,
        reason: 'User not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_USER_INFO_SUCCESS', {
      userId: userId,
      username: user.username,
      timestamp: new Date().toISOString()
    });

    return user;
  } catch (error) {
    // ถ้าไม่ได้ log ไว้แล้ว ให้ log error ทั่วไป
    if (!error.message.includes('User not found')) {
      await createLog(userId, 'GET_USER_INFO_FAIL', {
        userId: userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

module.exports = {
  register,
  login,
  getUserInfo,
  createLog,
  changePassword: async (userId, { oldPassword, newPassword }) => {
    try {
      // ตรวจสอบรหัสผ่านเก่า
      const userQuery = 'SELECT * FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [userId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      
      if (!isValidPassword) {
        throw new Error('Invalid old password');
      }
      
      // เข้ารหัสรหัสผ่านใหม่
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // อัพเดทรหัสผ่าน
      const updateQuery = 'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2';
      await pool.query(updateQuery, [hashedNewPassword, userId]);
      
      await createLog(userId, 'PASSWORD_CHANGE', 'Password changed successfully');
      return { message: 'Password changed successfully' };
      
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  },
  updateProfile: async (userId, updateData) => {
    try {
      const allowedFields = ['username', 'email'];
      const updateFields = [];
      const values = [];
      let paramCount = 1;
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updateFields.push(`${field} = $${paramCount}`);
          values.push(updateData[field]);
          paramCount++;
        }
      }
      
      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
      values.push(userId);
      
      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount + 1}
        RETURNING id, username, email, created_at, updated_at
      `;
      
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      await createLog(userId, 'PROFILE_UPDATE', 'Profile updated successfully');
      return result.rows[0];
      
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
};