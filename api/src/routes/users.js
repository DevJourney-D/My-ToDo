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

// User Data routes (from userData.js)
const UserDataController = require('../controllers/userData.controller');
// Root route - return available endpoints
router.get('/data', (req, res) => {
	res.json({
		success: true,
		message: 'User Data API',
		endpoints: {
			backup: '/data/backup',
			restore: '/data/restore',
			export: '/data/export',
			import: '/data/import',
			statistics: '/data/statistics',
			cleanup: '/data/cleanup',
			integrity: '/data/integrity',
			sync: '/data/sync'
		}
	});
});

// Data backup and restore
router.get('/data/backup', UserDataController.createBackup);
router.post('/data/restore', UserDataController.restoreFromBackup);

// Data export and import
router.get('/data/export', UserDataController.exportData);
router.post('/data/import', UserDataController.importData);

// Data management
router.get('/data/statistics', UserDataController.getDataStatistics);
router.delete('/data/cleanup', UserDataController.cleanupData);
router.get('/data/integrity', UserDataController.checkDataIntegrity);

// Data synchronization
router.post('/data/sync', UserDataController.syncData);

// Data history
router.get('/data/history/:dataType/:id', UserDataController.getDataHistory);