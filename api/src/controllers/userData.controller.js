const userDataService = require('../services/userData.service');
const pool = require('../config/database');
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
 * ดึงข้อมูลทั้งหมดของผู้ใช้หลังจากเข้าสู่ระบบ
 */
const getUserCompleteData = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    
    // รับ pagination parameters
    const options = {
      todoPage: parseInt(req.query.todoPage) || 1,
      todoLimit: parseInt(req.query.todoLimit) || 20,
      tagPage: parseInt(req.query.tagPage) || 1,
      tagLimit: parseInt(req.query.tagLimit) || 50,
      activityPage: parseInt(req.query.activityPage) || 1,
      activityLimit: parseInt(req.query.activityLimit) || 10
    };

    const completeData = await userDataService.getUserCompleteData(userId, options);
    
    res.status(200).json({ 
      message: 'User complete data loaded successfully',
      data: completeData 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error loading user complete data', error: error.message });
  }
};

/**
 * ดึงข้อมูล dashboard สำหรับหน้าแรก
 */
const getDashboardData = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    
    // รับ pagination parameters
    const options = {
      todayPage: parseInt(req.query.todayPage) || 1,
      todayLimit: parseInt(req.query.todayLimit) || 10,
      overduePage: parseInt(req.query.overduePage) || 1,
      overdueLimit: parseInt(req.query.overdueLimit) || 10,
      highPriorityPage: parseInt(req.query.highPriorityPage) || 1,
      highPriorityLimit: parseInt(req.query.highPriorityLimit) || 10,
      recentCompletedPage: parseInt(req.query.recentCompletedPage) || 1,
      recentCompletedLimit: parseInt(req.query.recentCompletedLimit) || 5
    };

    const dashboardData = await userDataService.getDashboardData(userId, options);
    
    res.status(200).json({ 
      message: 'Dashboard data loaded successfully',
      data: dashboardData 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error loading dashboard data', error: error.message });
  }
};

/**
 * ดึงข้อมูลสำหรับ sidebar/navigation
 */
const getNavigationData = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const navigationData = await userDataService.getNavigationData(userId);
    
    res.status(200).json({ 
      message: 'Navigation data loaded successfully',
      data: navigationData 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error loading navigation data', error: error.message });
  }
};

/**
 * รีเฟรชข้อมูลผู้ใช้ทั้งหมด
 */
const refreshUserData = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const refreshedData = await userDataService.refreshUserData(userId);
    
    res.status(200).json({ 
      message: 'User data refreshed successfully',
      data: refreshedData 
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error refreshing user data', error: error.message });
  }
};

/**
 * ดึงข้อมูลแบบแบ่งส่วน (lazy loading) พร้อม advanced pagination
 */
const getLazyLoadData = async (req, res) => {
  try {
    const userId = getUserIdFromToken(req);
    const { 
      section, 
      page = 1, 
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      filter = '',
      status = 'all',
      priority = 'all',
      tag = ''
    } = req.query;
    
    let data = {};
    const offset = (page - 1) * limit;
    const actualLimit = Math.min(parseInt(limit), 100); // จำกัดไม่เกิน 100 รายการต่อครั้ง

    // สร้าง WHERE clause สำหรับ filter
    let whereClause = `WHERE user_id = $1`;
    let params = [userId];
    let paramIndex = 2;

    // เพิ่ม filter conditions
    if (status !== 'all') {
      whereClause += ` AND is_completed = $${paramIndex}`;
      params.push(status === 'completed');
      paramIndex++;
    }

    if (priority !== 'all') {
      whereClause += ` AND priority = $${paramIndex}`;
      params.push(parseInt(priority));
      paramIndex++;
    }

    if (filter) {
      whereClause += ` AND text ILIKE $${paramIndex}`;
      params.push(`%${filter}%`);
      paramIndex++;
    }

    switch (section) {
      case 'todos':
        // นับจำนวนทั้งหมด
        const todosCountQuery = `SELECT COUNT(*) as total FROM public.todos ${whereClause}`;
        const todosCountResult = await pool.query(todosCountQuery, params);
        const totalTodos = parseInt(todosCountResult.rows[0].total);

        // ดึงข้อมูล todos พร้อม tags
        const todosQuery = `
          SELECT 
            td.*,
            COALESCE(
              JSON_AGG(
                JSON_BUILD_OBJECT('id', t.id, 'name', t.name)
              ) FILTER (WHERE t.id IS NOT NULL), 
              '[]'
            ) as tags
          FROM public.todos td
          LEFT JOIN public.todo_tags tt ON td.id = tt.todo_id
          LEFT JOIN public.tags t ON tt.tag_id = t.id
          ${whereClause}
          GROUP BY td.id, td.user_id, td.text, td.is_completed, td.priority, td.due_date, td.created_at, td.updated_at
          ORDER BY td.${sortBy} ${sortOrder}
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        const todosResult = await pool.query(todosQuery, [...params, actualLimit, offset]);
        
        data.todos = todosResult.rows;
        data.pagination = {
          current_page: parseInt(page),
          per_page: actualLimit,
          total: totalTodos,
          total_pages: Math.ceil(totalTodos / actualLimit),
          has_next: (page * actualLimit) < totalTodos,
          has_prev: page > 1
        };
        break;
        
      case 'completed':
        const completedWhereClause = `WHERE user_id = $1 AND is_completed = true`;
        let completedParams = [userId];
        let completedParamIndex = 2;

        if (filter) {
          completedWhereClause += ` AND text ILIKE $${completedParamIndex}`;
          completedParams.push(`%${filter}%`);
          completedParamIndex++;
        }

        const completedCountQuery = `SELECT COUNT(*) as total FROM public.todos ${completedWhereClause}`;
        const completedCountResult = await pool.query(completedCountQuery, completedParams);
        const totalCompleted = parseInt(completedCountResult.rows[0].total);

        const completedQuery = `
          SELECT * FROM public.todos 
          ${completedWhereClause}
          ORDER BY updated_at DESC 
          LIMIT $${completedParamIndex} OFFSET $${completedParamIndex + 1}
        `;
        const completedResult = await pool.query(completedQuery, [...completedParams, actualLimit, offset]);
        
        data.completed_todos = completedResult.rows;
        data.pagination = {
          current_page: parseInt(page),
          per_page: actualLimit,
          total: totalCompleted,
          total_pages: Math.ceil(totalCompleted / actualLimit),
          has_next: (page * actualLimit) < totalCompleted,
          has_prev: page > 1
        };
        break;
        
      case 'tags':
        let tagsWhereClause = `WHERE t.user_id = $1`;
        let tagsParams = [userId];
        let tagsParamIndex = 2;

        if (filter) {
          tagsWhereClause += ` AND t.name ILIKE $${tagsParamIndex}`;
          tagsParams.push(`%${filter}%`);
          tagsParamIndex++;
        }

        const tagsCountQuery = `SELECT COUNT(*) as total FROM public.tags t ${tagsWhereClause}`;
        const tagsCountResult = await pool.query(tagsCountQuery, tagsParams);
        const totalTags = parseInt(tagsCountResult.rows[0].total);

        const tagsQuery = `
          SELECT t.*, 
            COUNT(td.id) as todo_count,
            COUNT(CASE WHEN td.is_completed = false THEN 1 END) as pending_count,
            COUNT(CASE WHEN td.is_completed = true THEN 1 END) as completed_count
          FROM public.tags t
          LEFT JOIN public.todo_tags tt ON t.id = tt.tag_id
          LEFT JOIN public.todos td ON tt.todo_id = td.id
          ${tagsWhereClause}
          GROUP BY t.id, t.name, t.created_at
          ORDER BY t.name ASC
          LIMIT $${tagsParamIndex} OFFSET $${tagsParamIndex + 1}
        `;
        const tagsResult = await pool.query(tagsQuery, [...tagsParams, actualLimit, offset]);
        
        data.tags = tagsResult.rows;
        data.pagination = {
          current_page: parseInt(page),
          per_page: actualLimit,
          total: totalTags,
          total_pages: Math.ceil(totalTags / actualLimit),
          has_next: (page * actualLimit) < totalTags,
          has_prev: page > 1
        };
        break;

      case 'overdue':
        const overdueWhereClause = `WHERE user_id = $1 AND due_date < NOW() AND is_completed = false`;
        let overdueParams = [userId];
        let overdueParamIndex = 2;

        if (filter) {
          overdueWhereClause += ` AND text ILIKE $${overdueParamIndex}`;
          overdueParams.push(`%${filter}%`);
          overdueParamIndex++;
        }

        const overdueCountQuery = `SELECT COUNT(*) as total FROM public.todos ${overdueWhereClause}`;
        const overdueCountResult = await pool.query(overdueCountQuery, overdueParams);
        const totalOverdue = parseInt(overdueCountResult.rows[0].total);

        const overdueQuery = `
          SELECT *, 
            EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 as days_overdue
          FROM public.todos 
          ${overdueWhereClause}
          ORDER BY priority DESC, due_date ASC
          LIMIT $${overdueParamIndex} OFFSET $${overdueParamIndex + 1}
        `;
        const overdueResult = await pool.query(overdueQuery, [...overdueParams, actualLimit, offset]);
        
        data.overdue_todos = overdueResult.rows;
        data.pagination = {
          current_page: parseInt(page),
          per_page: actualLimit,
          total: totalOverdue,
          total_pages: Math.ceil(totalOverdue / actualLimit),
          has_next: (page * actualLimit) < totalOverdue,
          has_prev: page > 1
        };
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid section parameter. Use: todos, completed, tags, overdue' });
    }

    res.status(200).json({ 
      message: 'Lazy load data retrieved successfully',
      data,
      filters: {
        section,
        page: parseInt(page),
        limit: actualLimit,
        sortBy,
        sortOrder,
        filter,
        status,
        priority
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(500).json({ message: 'Error loading lazy data', error: error.message });
  }
};

module.exports = {
  getUserCompleteData,
  getDashboardData,
  getNavigationData,
  refreshUserData,
  getLazyLoadData,
};
