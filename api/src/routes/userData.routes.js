const express = require('express');
const router = express.Router();
const userDataController = require('../controllers/userData.controller');

// GET /api/user-data/complete - ดึงข้อมูลทั้งหมดของผู้ใช้หลังจากเข้าสู่ระบบ
router.get('/complete', userDataController.getUserCompleteData);

// GET /api/user-data/dashboard - ดึงข้อมูล dashboard สำหรับหน้าแรก
router.get('/dashboard', userDataController.getDashboardData);

// GET /api/user-data/navigation - ดึงข้อมูลสำหรับ sidebar/navigation
router.get('/navigation', userDataController.getNavigationData);

// POST /api/user-data/refresh - รีเฟรชข้อมูลผู้ใช้ทั้งหมด
router.post('/refresh', userDataController.refreshUserData);

// GET /api/user-data/lazy - ดึงข้อมูลแบบแบ่งส่วน (lazy loading)
router.get('/lazy', userDataController.getLazyLoadData);

module.exports = router;
