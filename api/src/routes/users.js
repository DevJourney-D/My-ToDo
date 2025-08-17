const express = require('express');
const UserController = require('../controllers/user.controller');
const router = express.Router();

// User profile routes
router.get('/', UserController.getProfile); // เพิ่ม root route เพื่อ redirect ไปยัง profile
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);
router.patch('/profile', UserController.updateProfile); // เพิ่ม PATCH support

// Password management
router.put('/password', UserController.changePassword);
router.patch('/password', UserController.changePassword); // เพิ่ม PATCH support

// User statistics and analytics
router.get('/statistics', UserController.getUserStatistics);
router.get('/activity', UserController.getUserActivity);

// User preferences
router.get('/preferences', UserController.getPreferences);
router.put('/preferences', UserController.updatePreferences);
router.patch('/preferences', UserController.updatePreferences); // เพิ่ม PATCH support

// Data export
router.get('/export', UserController.exportUserData);

// Account management
router.delete('/account', UserController.deleteAccount);

module.exports = router;