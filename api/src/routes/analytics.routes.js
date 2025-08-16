const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticateToken } = require('../middleware/auth');

// ใช้ authentication middleware สำหรับทุก route
router.use(authenticateToken);

// GET /api/analytics - สถิติหลักสำหรับ dashboard
router.get('/', analyticsController.getMainAnalytics || analyticsController.getWorkOverview);

// GET /api/analytics/overview - สถิติการทำงานโดยรวม
router.get('/overview', analyticsController.getWorkOverview);

// GET /api/analytics/daily - สถิติการทำงานรายวัน (7 วันที่ผ่านมา)
router.get('/daily', analyticsController.getDailyWorkStats);

// GET /api/analytics/weekly - สถิติการทำงานรายสัปดาห์ (4 สัปดาห์ที่ผ่านมา)
router.get('/weekly', analyticsController.getWeeklyWorkStats);

// GET /api/analytics/priority - สถิติตาม priority
router.get('/priority', analyticsController.getPriorityStats);

// GET /api/analytics/tags - สถิติตาม tags
router.get('/tags', analyticsController.getTagStats);

// GET /api/analytics/overdue - สถิติงานที่เกินกำหนด
router.get('/overdue', analyticsController.getOverdueStats);

// GET /api/analytics/usage - สถิติการใช้งานระบบ
router.get('/usage', analyticsController.getSystemUsageStats);

// GET /api/analytics/complete - รายงานการวิเคราะห์งานแบบครบวงจร
router.get('/complete', analyticsController.getCompleteWorkAnalysis);

// GET /api/analytics/custom - สถิติแบบกำหนดเอง
router.get('/custom', analyticsController.getCustomStats);

module.exports = router;
