const express = require('express');
const UserDataController = require('../controllers/userData.controller');
const router = express.Router();

// Root route - return available endpoints
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'User Data API',
    endpoints: {
      backup: '/backup',
      restore: '/restore',
      export: '/export',
      import: '/import',
      statistics: '/statistics',
      cleanup: '/cleanup',
      integrity: '/integrity',
      sync: '/sync'
    }
  });
});

// Data backup and restore
router.get('/backup', UserDataController.createBackup);
router.post('/restore', UserDataController.restoreFromBackup);

// Data export and import
router.get('/export', UserDataController.exportData);
router.post('/import', UserDataController.importData);

// Data management
router.get('/statistics', UserDataController.getDataStatistics);
router.delete('/cleanup', UserDataController.cleanupData);
router.get('/integrity', UserDataController.checkDataIntegrity);

// Data synchronization
router.post('/sync', UserDataController.syncData);

// Data history
router.get('/history/:dataType/:id', UserDataController.getDataHistory);

module.exports = router;
