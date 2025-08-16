const userService = require('../services/user.service');
const userDataService = require('../services/userData.service');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  try {
    const newUser = await userService.register(req.body);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    // จัดการกรณี username ซ้ำ (unique constraint error)
    if (error.code === '23505') {
        return res.status(400).json({ message: 'Username already exists' });
    }
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { user, token } = await userService.login(req.body);
    
    // ดึงข้อมูลทั้งหมดของผู้ใช้หลังจากเข้าสู่ระบบสำเร็จ (ใช้ default pagination)
    const completeData = await userDataService.getUserCompleteData(user.id, {
      todoLimit: 20, // โหลด 20 todos แรก
      tagLimit: 50,  // โหลด 50 tags แรก
      activityLimit: 10 // โหลด 10 activities แรก
    });
    
    res.status(200).json({ 
      message: 'Login successful', 
      user, 
      token,
      data: completeData
    });
  } catch (error) {
    // Service จะ throw error 'Invalid credentials' มา
    res.status(401).json({ message: error.message });
  }
};

const getUserInfo = async (req, res) => {
  try {
    // ดึง token จาก Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const token = authHeader.substring(7); // ลบ "Bearer " ออก
    
    // ตรวจสอบและ decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    
    // ดึงข้อมูลผู้ใช้จาก database
    const user = await userService.getUserInfo(userId);
    res.status(200).json({ user });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(404).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getUserInfo,
  changePassword: async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access token required' });
      }
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      await userService.changePassword(decoded.id, req.body);
      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      res.status(500).json({ message: 'Error changing password', error: error.message });
    }
  },
  updateProfile: async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access token required' });
      }
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const updatedUser = await userService.updateProfile(decoded.id, req.body);
      res.status(200).json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
  },
  exportUserData: async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access token required' });
      }
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const userData = await userDataService.getUserCompleteData(decoded.id);
      res.status(200).json(userData);
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      }
      res.status(500).json({ message: 'Error exporting data', error: error.message });
    }
  }
};