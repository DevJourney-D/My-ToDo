const analyticsService = require('../services/analytics.service');
const jwt = require('jsonwebtoken');

/**
 * ดึง userId จาก JWT token
 */
const getUserIdFromToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Access token required');
  }

  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.id;
};

/**
 * ดึงสถิติหลักสำหรับ dashboard
 */
const getMainAnalytics = async (req, res) => {
  try {
    const userId = req.user.id; // ใช้จาก middleware แทน
    const analytics = await analyticsService.getMainAnalytics(userId);
    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching main analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

/**
 * ดึงสถิติการทำงานโดยรวม
 */
const getWorkOverview = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const overview = await analyticsService.getWorkOverview(userId);
    res.status(200).json({ overview });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching work overview', error: error.message });
  }
};

/**
 * ดึงสถิติการทำงานรายวัน
 */
const getDailyWorkStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const dailyStats = await analyticsService.getDailyWorkStats(userId);
    res.status(200).json({ daily_stats: dailyStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching daily work stats', error: error.message });
  }
};

/**
 * ดึงสถิติการทำงานรายสัปดาห์
 */
const getWeeklyWorkStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const weeklyStats = await analyticsService.getWeeklyWorkStats(userId);
    res.status(200).json({ weekly_stats: weeklyStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching weekly work stats', error: error.message });
  }
};

/**
 * ดึงสถิติตาม priority
 */
const getPriorityStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const priorityStats = await analyticsService.getPriorityStats(userId);
    res.status(200).json({ priority_stats: priorityStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching priority stats', error: error.message });
  }
};

/**
 * ดึงสถิติตาม tags
 */
const getTagStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const tagStats = await analyticsService.getTagStats(userId);
    res.status(200).json({ tag_stats: tagStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching tag stats', error: error.message });
  }
};

/**
 * ดึงสถิติงานที่เกินกำหนด
 */
const getOverdueStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const overdueStats = await analyticsService.getOverdueStats(userId);
    res.status(200).json({ overdue_stats: overdueStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching overdue stats', error: error.message });
  }
};

/**
 * ดึงสถิติการใช้งานระบบ
 */
const getSystemUsageStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const usageStats = await analyticsService.getSystemUsageStats(userId);
    res.status(200).json({ usage_stats: usageStats });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching system usage stats', error: error.message });
  }
};

/**
 * ดึงรายงานการวิเคราะห์งานแบบครบวงจร
 */
const getCompleteWorkAnalysis = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const analysis = await analyticsService.getCompleteWorkAnalysis(userId);
    res.status(200).json({ analysis });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching complete work analysis', error: error.message });
  }
};

/**
 * ดึงสถิติแบบกำหนดเอง (custom date range)
 */
const getCustomStats = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { start_date, end_date, stat_type } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'start_date and end_date are required' });
    }

    let stats;
    switch (stat_type) {
      case 'daily':
        stats = await analyticsService.getDailyWorkStats(userId);
        break;
      case 'weekly':
        stats = await analyticsService.getWeeklyWorkStats(userId);
        break;
      case 'priority':
        stats = await analyticsService.getPriorityStats(userId);
        break;
      case 'tags':
        stats = await analyticsService.getTagStats(userId);
        break;
      default:
        stats = await analyticsService.getWorkOverview(userId);
    }

    res.status(200).json({ 
      stats,
      period: { start_date, end_date, stat_type }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error fetching custom stats', error: error.message });
  }
};

module.exports = {
  getMainAnalytics,
  getWorkOverview,
  getDailyWorkStats,
  getWeeklyWorkStats,
  getPriorityStats,
  getTagStats,
  getOverdueStats,
  getSystemUsageStats,
  getCompleteWorkAnalysis,
  getCustomStats,
};
