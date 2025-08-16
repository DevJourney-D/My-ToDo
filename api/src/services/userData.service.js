const pool = require('../config/database');
const { createLog } = require('./user.service');

/**
 * ดึงข้อมูลทั้งหมดของผู้ใช้หลังจากเข้าสู่ระบบ (พร้อม pagination)
 */
const getUserCompleteData = async (userId, options = {}) => {
  try {
    const {
      todoPage = 1,
      todoLimit = 20,
      tagPage = 1,
      tagLimit = 50,
      activityPage = 1,
      activityLimit = 10
    } = options;

    const todoOffset = (todoPage - 1) * todoLimit;
    const tagOffset = (tagPage - 1) * tagLimit;
    const activityOffset = (activityPage - 1) * activityLimit;

    // ดึงข้อมูลผู้ใช้
    const userQuery = 'SELECT id, username, created_at FROM public.users WHERE id = $1';
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];

    // นับจำนวน todos ทั้งหมด
    const todoCountQuery = 'SELECT COUNT(*) as total FROM public.todos WHERE user_id = $1';
    const todoCountResult = await pool.query(todoCountQuery, [userId]);
    const totalTodos = parseInt(todoCountResult.rows[0].total);

    // ดึงข้อมูล todos พร้อม tags (มี pagination)
    const todosQuery = `
      SELECT 
        td.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT('id', t.id, 'name', t.name, 'created_at', t.created_at)
          ) FILTER (WHERE t.id IS NOT NULL), 
          '[]'
        ) as tags
      FROM public.todos td
      LEFT JOIN public.todo_tags tt ON td.id = tt.todo_id
      LEFT JOIN public.tags t ON tt.tag_id = t.id
      WHERE td.user_id = $1
      GROUP BY td.id, td.user_id, td.text, td.is_completed, td.priority, td.due_date, td.created_at, td.updated_at
      ORDER BY td.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const todosResult = await pool.query(todosQuery, [userId, todoLimit, todoOffset]);

    // นับจำนวน tags ทั้งหมด
    const tagCountQuery = 'SELECT COUNT(*) as total FROM public.tags WHERE user_id = $1';
    const tagCountResult = await pool.query(tagCountQuery, [userId]);
    const totalTags = parseInt(tagCountResult.rows[0].total);

    // ดึงข้อมูล tags ทั้งหมด (มี pagination)
    const tagsQuery = `
      SELECT t.*, COUNT(td.id) as todo_count
      FROM public.tags t
      LEFT JOIN public.todo_tags tt ON t.id = tt.tag_id
      LEFT JOIN public.todos td ON tt.todo_id = td.id
      WHERE t.user_id = $1
      GROUP BY t.id, t.name, t.created_at
      ORDER BY t.name ASC
      LIMIT $2 OFFSET $3
    `;
    const tagsResult = await pool.query(tagsQuery, [userId, tagLimit, tagOffset]);

    // ดึงสถิติการทำงานโดยรวม
    const overviewQuery = `
      SELECT 
        COUNT(*) as total_todos,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as pending_todos,
        ROUND(
          (COUNT(CASE WHEN is_completed = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
        ) as completion_rate,
        COUNT(CASE WHEN due_date < NOW() AND is_completed = false THEN 1 END) as overdue_todos,
        COUNT(CASE WHEN priority = 1 THEN 1 END) as low_priority,
        COUNT(CASE WHEN priority = 2 THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 3 THEN 1 END) as high_priority
      FROM public.todos 
      WHERE user_id = $1
    `;
    const overviewResult = await pool.query(overviewQuery, [userId]);

    // ดึงงานที่เกินกำหนดที่สำคัญ (แค่ 5 รายการ)
    const overdueQuery = `
      SELECT id, text, priority, due_date,
        EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 as days_overdue
      FROM public.todos 
      WHERE user_id = $1 
        AND due_date < NOW() 
        AND is_completed = false
      ORDER BY priority DESC, due_date ASC
      LIMIT 5
    `;
    const overdueResult = await pool.query(overdueQuery, [userId]);

    // นับจำนวน activities ทั้งหมด
    const activityCountQuery = `
      SELECT COUNT(*) as total FROM public.logs 
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
    `;
    const activityCountResult = await pool.query(activityCountQuery, [userId]);
    const totalActivities = parseInt(activityCountResult.rows[0].total);

    // ดึงข้อมูลการใช้งานล่าสุด (มี pagination)
    const recentActivityQuery = `
      SELECT action, details, created_at
      FROM public.logs 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const recentActivityResult = await pool.query(recentActivityQuery, [userId, activityLimit, activityOffset]);

    // สร้าง dashboard data (ใช้ข้อมูลจาก todos ที่โหลดมา)
    const dashboardData = {
      recent_todos: todosResult.rows.slice(0, 5), // 5 todos ล่าสุด
      pending_todos: todosResult.rows.filter(todo => !todo.is_completed).slice(0, 10),
      overdue_todos: overdueResult.rows,
      high_priority_todos: todosResult.rows.filter(todo => todo.priority === 3 && !todo.is_completed).slice(0, 5),
      today_todos: todosResult.rows.filter(todo => {
        if (!todo.due_date) return false;
        const today = new Date().toDateString();
        const todoDate = new Date(todo.due_date).toDateString();
        return today === todoDate && !todo.is_completed;
      })
    };

    // สร้าง quick stats
    const quickStats = {
      todos_today: dashboardData.today_todos.length,
      overdue_count: overdueResult.rows.length,
      high_priority_count: dashboardData.high_priority_todos.length,
      completion_rate: overviewResult.rows[0].completion_rate || 0
    };

    // สร้าง pagination info
    const pagination = {
      todos: {
        current_page: todoPage,
        per_page: todoLimit,
        total: totalTodos,
        total_pages: Math.ceil(totalTodos / todoLimit),
        has_next: (todoPage * todoLimit) < totalTodos,
        has_prev: todoPage > 1
      },
      tags: {
        current_page: tagPage,
        per_page: tagLimit,
        total: totalTags,
        total_pages: Math.ceil(totalTags / tagLimit),
        has_next: (tagPage * tagLimit) < totalTags,
        has_prev: tagPage > 1
      },
      activities: {
        current_page: activityPage,
        per_page: activityLimit,
        total: totalActivities,
        total_pages: Math.ceil(totalActivities / activityLimit),
        has_next: (activityPage * activityLimit) < totalActivities,
        has_prev: activityPage > 1
      }
    };

    const completeData = {
      user,
      todos: todosResult.rows,
      tags: tagsResult.rows,
      overview: overviewResult.rows[0],
      dashboard: dashboardData,
      quick_stats: quickStats,
      recent_activity: recentActivityResult.rows,
      pagination,
      loaded_at: new Date().toISOString()
    };

    // บันทึก log สำเร็จ
    await createLog(userId, 'LOAD_USER_COMPLETE_DATA_SUCCESS', {
      todosCount: todosResult.rows.length,
      tagsCount: tagsResult.rows.length,
      totalTodos,
      totalTags,
      pagination: {
        todoPage,
        tagPage,
        activityPage
      },
      timestamp: new Date().toISOString()
    });

    return completeData;
  } catch (error) {
    await createLog(userId, 'LOAD_USER_COMPLETE_DATA_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงข้อมูล dashboard สำหรับหน้าแรก (พร้อม pagination)
 */
const getDashboardData = async (userId, options = {}) => {
  try {
    const {
      todayPage = 1,
      todayLimit = 10,
      overduePage = 1,
      overdueLimit = 10,
      highPriorityPage = 1,
      highPriorityLimit = 10,
      recentCompletedPage = 1,
      recentCompletedLimit = 5
    } = options;

    const todayOffset = (todayPage - 1) * todayLimit;
    const overdueOffset = (overduePage - 1) * overdueLimit;
    const highPriorityOffset = (highPriorityPage - 1) * highPriorityLimit;
    const recentCompletedOffset = (recentCompletedPage - 1) * recentCompletedLimit;

    // นับและดึงงานที่ต้องทำวันนี้
    const todayCountQuery = `
      SELECT COUNT(*) as total FROM public.todos 
      WHERE user_id = $1 
        AND DATE(due_date) = CURRENT_DATE
        AND is_completed = false
    `;
    const todayCountResult = await pool.query(todayCountQuery, [userId]);
    const totalTodayTodos = parseInt(todayCountResult.rows[0].total);

    const todayQuery = `
      SELECT * FROM public.todos 
      WHERE user_id = $1 
        AND DATE(due_date) = CURRENT_DATE
        AND is_completed = false
      ORDER BY priority DESC, due_date ASC
      LIMIT $2 OFFSET $3
    `;
    const todayResult = await pool.query(todayQuery, [userId, todayLimit, todayOffset]);

    // นับและดึงงานที่เกินกำหนด
    const overdueCountQuery = `
      SELECT COUNT(*) as total FROM public.todos 
      WHERE user_id = $1 
        AND due_date < NOW() 
        AND is_completed = false
    `;
    const overdueCountResult = await pool.query(overdueCountQuery, [userId]);
    const totalOverdueTodos = parseInt(overdueCountResult.rows[0].total);

    const overdueQuery = `
      SELECT * FROM public.todos 
      WHERE user_id = $1 
        AND due_date < NOW() 
        AND is_completed = false
      ORDER BY priority DESC, due_date ASC
      LIMIT $2 OFFSET $3
    `;
    const overdueResult = await pool.query(overdueQuery, [userId, overdueLimit, overdueOffset]);

    // นับและดึงงานที่สำคัญ (priority 3)
    const highPriorityCountQuery = `
      SELECT COUNT(*) as total FROM public.todos 
      WHERE user_id = $1 
        AND priority = 3
        AND is_completed = false
    `;
    const highPriorityCountResult = await pool.query(highPriorityCountQuery, [userId]);
    const totalHighPriorityTodos = parseInt(highPriorityCountResult.rows[0].total);

    const highPriorityQuery = `
      SELECT * FROM public.todos 
      WHERE user_id = $1 
        AND priority = 3
        AND is_completed = false
      ORDER BY due_date ASC
      LIMIT $2 OFFSET $3
    `;
    const highPriorityResult = await pool.query(highPriorityQuery, [userId, highPriorityLimit, highPriorityOffset]);

    // นับและดึงงานที่เสร็จเมื่อเร็วๆ นี้
    const recentCompletedCountQuery = `
      SELECT COUNT(*) as total FROM public.todos 
      WHERE user_id = $1 
        AND is_completed = true
        AND updated_at >= NOW() - INTERVAL '7 days'
    `;
    const recentCompletedCountResult = await pool.query(recentCompletedCountQuery, [userId]);
    const totalRecentCompletedTodos = parseInt(recentCompletedCountResult.rows[0].total);

    const recentCompletedQuery = `
      SELECT * FROM public.todos 
      WHERE user_id = $1 
        AND is_completed = true
        AND updated_at >= NOW() - INTERVAL '7 days'
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3
    `;
    const recentCompletedResult = await pool.query(recentCompletedQuery, [userId, recentCompletedLimit, recentCompletedOffset]);

    // สถิติด่วน
    const quickStatsQuery = `
      SELECT 
        COUNT(*) as total_todos,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN due_date < NOW() AND is_completed = false THEN 1 END) as overdue_todos,
        COUNT(CASE WHEN DATE(due_date) = CURRENT_DATE AND is_completed = false THEN 1 END) as today_todos,
        COUNT(CASE WHEN priority = 3 AND is_completed = false THEN 1 END) as high_priority_todos
      FROM public.todos 
      WHERE user_id = $1
    `;
    const quickStatsResult = await pool.query(quickStatsQuery, [userId]);

    // สร้าง pagination info
    const pagination = {
      today_todos: {
        current_page: todayPage,
        per_page: todayLimit,
        total: totalTodayTodos,
        total_pages: Math.ceil(totalTodayTodos / todayLimit),
        has_next: (todayPage * todayLimit) < totalTodayTodos,
        has_prev: todayPage > 1
      },
      overdue_todos: {
        current_page: overduePage,
        per_page: overdueLimit,
        total: totalOverdueTodos,
        total_pages: Math.ceil(totalOverdueTodos / overdueLimit),
        has_next: (overduePage * overdueLimit) < totalOverdueTodos,
        has_prev: overduePage > 1
      },
      high_priority_todos: {
        current_page: highPriorityPage,
        per_page: highPriorityLimit,
        total: totalHighPriorityTodos,
        total_pages: Math.ceil(totalHighPriorityTodos / highPriorityLimit),
        has_next: (highPriorityPage * highPriorityLimit) < totalHighPriorityTodos,
        has_prev: highPriorityPage > 1
      },
      recent_completed: {
        current_page: recentCompletedPage,
        per_page: recentCompletedLimit,
        total: totalRecentCompletedTodos,
        total_pages: Math.ceil(totalRecentCompletedTodos / recentCompletedLimit),
        has_next: (recentCompletedPage * recentCompletedLimit) < totalRecentCompletedTodos,
        has_prev: recentCompletedPage > 1
      }
    };

    const dashboardData = {
      today_todos: todayResult.rows,
      overdue_todos: overdueResult.rows,
      high_priority_todos: highPriorityResult.rows,
      recent_completed: recentCompletedResult.rows,
      quick_stats: quickStatsResult.rows[0],
      pagination,
      loaded_at: new Date().toISOString()
    };

    // บันทึก log สำเร็จ
    await createLog(userId, 'LOAD_DASHBOARD_DATA_SUCCESS', {
      todayCount: todayResult.rows.length,
      overdueCount: overdueResult.rows.length,
      totalTodayTodos,
      totalOverdueTodos,
      pagination: {
        todayPage,
        overduePage,
        highPriorityPage
      },
      timestamp: new Date().toISOString()
    });

    return dashboardData;
  } catch (error) {
    await createLog(userId, 'LOAD_DASHBOARD_DATA_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงข้อมูลสำหรับ sidebar/navigation
 */
const getNavigationData = async (userId) => {
  try {
    // นับจำนวน todos ในแต่ละหมวดหมู่
    const countsQuery = `
      SELECT 
        COUNT(*) as total_todos,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as pending_todos,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN due_date < NOW() AND is_completed = false THEN 1 END) as overdue_todos,
        COUNT(CASE WHEN DATE(due_date) = CURRENT_DATE AND is_completed = false THEN 1 END) as today_todos,
        COUNT(CASE WHEN priority = 3 AND is_completed = false THEN 1 END) as high_priority_todos
      FROM public.todos 
      WHERE user_id = $1
    `;
    const countsResult = await pool.query(countsQuery, [userId]);

    // ดึง tags พร้อมจำนวน todos
    const tagsQuery = `
      SELECT 
        t.id,
        t.name,
        COUNT(td.id) as todo_count,
        COUNT(CASE WHEN td.is_completed = false THEN 1 END) as pending_count
      FROM public.tags t
      LEFT JOIN public.todo_tags tt ON t.id = tt.tag_id
      LEFT JOIN public.todos td ON tt.todo_id = td.id
      WHERE t.user_id = $1
      GROUP BY t.id, t.name
      ORDER BY t.name ASC
    `;
    const tagsResult = await pool.query(tagsQuery, [userId]);

    const navigationData = {
      counts: countsResult.rows[0],
      tags: tagsResult.rows,
      loaded_at: new Date().toISOString()
    };

    // บันทึก log สำเร็จ
    await createLog(userId, 'LOAD_NAVIGATION_DATA_SUCCESS', {
      tagsCount: tagsResult.rows.length,
      timestamp: new Date().toISOString()
    });

    return navigationData;
  } catch (error) {
    await createLog(userId, 'LOAD_NAVIGATION_DATA_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * รีเฟรชข้อมูลผู้ใช้ (เรียกใช้เมื่อมีการเปลี่ยนแปลงข้อมูล)
 */
const refreshUserData = async (userId) => {
  try {
    const [completeData, dashboardData, navigationData] = await Promise.all([
      getUserCompleteData(userId),
      getDashboardData(userId),
      getNavigationData(userId)
    ]);

    const refreshedData = {
      complete: completeData,
      dashboard: dashboardData,
      navigation: navigationData,
      refreshed_at: new Date().toISOString()
    };

    // บันทึก log สำเร็จ
    await createLog(userId, 'REFRESH_USER_DATA_SUCCESS', {
      timestamp: new Date().toISOString()
    });

    return refreshedData;
  } catch (error) {
    await createLog(userId, 'REFRESH_USER_DATA_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

module.exports = {
  getUserCompleteData,
  getDashboardData,
  getNavigationData,
  refreshUserData,
};
