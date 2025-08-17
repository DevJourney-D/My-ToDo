const express = require('express');
const AnalyticsController = require('../controllers/analytics.controller');
const router = express.Router();

// Analytics routes
router.get('/', AnalyticsController.getDashboardOverview); // เพิ่ม root route
router.get('/dashboard', AnalyticsController.getDashboardOverview);
router.get('/todos/stats', AnalyticsController.getTodoStats);
router.get('/todos/priority-breakdown', AnalyticsController.getPriorityBreakdown);
router.get('/todos/trends', AnalyticsController.getTodoTrends);
router.get('/tags/popular', AnalyticsController.getPopularTags);
router.get('/activity/stats', AnalyticsController.getUserActivityStats);
router.get('/performance/comparison', AnalyticsController.getPerformanceComparison);
router.get('/logs/user', AnalyticsController.getUserLogs);

module.exports = router;