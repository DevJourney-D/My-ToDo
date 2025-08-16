const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// POST /api/auth/register
router.post('/register', userController.register);


// POST /api/auth/login
router.post('/login', userController.login);

// GET /api/auth/user (ดึงข้อมูลจาก token)
router.get('/user', userController.getUserInfo);

// GET /api/auth/verify (ตรวจสอบ token)
router.get('/verify', userController.getUserInfo);

// GET /api/auth/getUserInfo (alias for compatibility)
router.get('/getUserInfo', userController.getUserInfo);

module.exports = router;