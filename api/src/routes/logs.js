const express = require('express');
const LogController = require('../controllers/log.controller');
const router = express.Router();

// Log routes
router.get('/', LogController.getLogs);
router.get('/actions', LogController.getLogActions);
router.get('/stats', LogController.getLogStats);
router.get('/export', LogController.exportLogs);

router.post('/', LogController.createLog);
router.post('/cleanup', LogController.cleanupLogs);

router.delete('/bulk', LogController.bulkDeleteLogs);

module.exports = router;
