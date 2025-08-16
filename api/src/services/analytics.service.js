const pool = require('../config/database');
const { createLog } = require('./user.service');

/**
 * ดึงสถิติหลักสำหรับ dashboard
 */
const getMainAnalytics = async (userId) => {
  try {
    // ดึงข้อมูล todos และ completion stats
    const todoStatsQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as incomplete_tasks
      FROM todos 
      WHERE user_id = $1
    `;
    
    const todoStatsResult = await pool.query(todoStatsQuery, [userId]);
    const stats = todoStatsResult.rows[0];
    
    // ดึงข้อมูล tasks by tag
    const tagStatsQuery = `
      SELECT t.name, COUNT(tt.todo_id) as count
      FROM tags t
      LEFT JOIN todo_tags tt ON t.id = tt.tag_id
      LEFT JOIN todos td ON tt.todo_id = td.id
      WHERE t.user_id = $1
      GROUP BY t.id, t.name
      ORDER BY count DESC
    `;
    
    const tagStatsResult = await pool.query(tagStatsQuery, [userId]);
    
    // ดึงข้อมูล tasks by date (7 วันที่ผ่านมา)
    const dateStatsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM todos
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    
    const dateStatsResult = await pool.query(dateStatsQuery, [userId]);
    
    const analytics = {
      completionStats: [
        { name: 'Completed', value: parseInt(stats.completed_tasks) },
        { name: 'Incomplete', value: parseInt(stats.incomplete_tasks) }
      ],
      tasksByTag: tagStatsResult.rows.map(row => ({
        name: row.name,
        count: parseInt(row.count)
      })),
      totalTasks: parseInt(stats.total_tasks),
      completedTasks: parseInt(stats.completed_tasks),
      incompleteTasks: parseInt(stats.incomplete_tasks),
      tasksByDate: dateStatsResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    };
    
    await createLog(userId, 'ANALYTICS_VIEW', `Viewed main analytics`);
    return analytics;
    
  } catch (error) {
    console.error('Error in getMainAnalytics:', error);
    throw error;
  }
};

/**
 * ดึงสถิติการทำงานโดยรวม
 */
const getWorkOverview = async (userId) => {
  try {
    const query = `
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
    
    const result = await pool.query(query, [userId]);
    const overview = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_WORK_OVERVIEW_SUCCESS', {
      timestamp: new Date().toISOString()
    });

    return overview;
  } catch (error) {
    await createLog(userId, 'GET_WORK_OVERVIEW_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติการทำงานรายวัน (7 วันที่ผ่านมา)
 */
const getDailyWorkStats = async (userId) => {
  try {
    const query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as todos_created,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as todos_completed
      FROM public.todos 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_DAILY_WORK_STATS_SUCCESS', {
      dayCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    await createLog(userId, 'GET_DAILY_WORK_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติการทำงานรายสัปดาห์ (4 สัปดาห์ที่ผ่านมา)
 */
const getWeeklyWorkStats = async (userId) => {
  try {
    const query = `
      SELECT 
        DATE_TRUNC('week', created_at) as week_start,
        COUNT(*) as todos_created,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as todos_completed,
        ROUND(
          (COUNT(CASE WHEN is_completed = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
        ) as completion_rate
      FROM public.todos 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '4 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week_start DESC
    `;
    
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_WEEKLY_WORK_STATS_SUCCESS', {
      weekCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    await createLog(userId, 'GET_WEEKLY_WORK_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติตาม priority
 */
const getPriorityStats = async (userId) => {
  try {
    const query = `
      SELECT 
        priority,
        CASE 
          WHEN priority = 1 THEN 'Low'
          WHEN priority = 2 THEN 'Medium'
          WHEN priority = 3 THEN 'High'
          ELSE 'Unknown'
        END as priority_label,
        COUNT(*) as total_todos,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_todos,
        ROUND(
          (COUNT(CASE WHEN is_completed = true THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 2
        ) as completion_rate,
        AVG(
          CASE WHEN is_completed = true 
          THEN EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 
          END
        ) as avg_completion_hours
      FROM public.todos 
      WHERE user_id = $1
      GROUP BY priority
      ORDER BY priority DESC
    `;
    
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_PRIORITY_STATS_SUCCESS', {
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    await createLog(userId, 'GET_PRIORITY_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติตาม tags
 */
const getTagStats = async (userId) => {
  try {
    const query = `
      SELECT 
        t.id,
        t.name as tag_name,
        COUNT(td.id) as total_todos,
        COUNT(CASE WHEN td.is_completed = true THEN 1 END) as completed_todos,
        ROUND(
          (COUNT(CASE WHEN td.is_completed = true THEN 1 END) * 100.0 / NULLIF(COUNT(td.id), 0)), 2
        ) as completion_rate
      FROM public.tags t
      LEFT JOIN public.todo_tags tt ON t.id = tt.tag_id
      LEFT JOIN public.todos td ON tt.todo_id = td.id
      WHERE t.user_id = $1
      GROUP BY t.id, t.name
      HAVING COUNT(td.id) > 0
      ORDER BY total_todos DESC
    `;
    
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TAG_STATS_SUCCESS', {
      tagCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    await createLog(userId, 'GET_TAG_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติงานที่เกินกำหนด
 */
const getOverdueStats = async (userId) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_overdue,
        COUNT(CASE WHEN priority = 1 THEN 1 END) as low_priority_overdue,
        COUNT(CASE WHEN priority = 2 THEN 1 END) as medium_priority_overdue,
        COUNT(CASE WHEN priority = 3 THEN 1 END) as high_priority_overdue,
        AVG(EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400) as avg_days_overdue
      FROM public.todos 
      WHERE user_id = $1 
        AND due_date < NOW() 
        AND is_completed = false
    `;
    
    const result = await pool.query(query, [userId]);
    const overdueStats = result.rows[0];

    // ดึงรายการงานที่เกินกำหนดที่สำคัญ
    const overdueItemsQuery = `
      SELECT id, text, priority, due_date,
        EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400 as days_overdue
      FROM public.todos 
      WHERE user_id = $1 
        AND due_date < NOW() 
        AND is_completed = false
      ORDER BY priority DESC, due_date ASC
      LIMIT 10
    `;
    
    const overdueItemsResult = await pool.query(overdueItemsQuery, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_OVERDUE_STATS_SUCCESS', {
      overdueCount: overdueStats.total_overdue,
      timestamp: new Date().toISOString()
    });

    return {
      ...overdueStats,
      overdue_items: overdueItemsResult.rows
    };
  } catch (error) {
    await createLog(userId, 'GET_OVERDUE_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติการใช้งานระบบ
 */
const getSystemUsageStats = async (userId) => {
  try {
    const query = `
      SELECT 
        action,
        COUNT(*) as count,
        MAX(created_at) as last_action
      FROM public.logs 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY action
      ORDER BY count DESC
    `;
    
    const result = await pool.query(query, [userId]);

    // สถิติการเข้าสู่ระบบ
    const loginStatsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as login_count
      FROM public.logs 
      WHERE user_id = $1 
        AND action = 'LOGIN_SUCCESS'
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    
    const loginResult = await pool.query(loginStatsQuery, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_SYSTEM_USAGE_STATS_SUCCESS', {
      actionCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return {
      action_stats: result.rows,
      login_stats: loginResult.rows
    };
  } catch (error) {
    await createLog(userId, 'GET_SYSTEM_USAGE_STATS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงรายงานการวิเคราะห์งานแบบครบวงจร
 */
const getCompleteWorkAnalysis = async (userId) => {
  try {
    const [
      overview,
      dailyStats,
      weeklyStats,
      priorityStats,
      tagStats,
      overdueStats,
      usageStats
    ] = await Promise.all([
      getWorkOverview(userId),
      getDailyWorkStats(userId),
      getWeeklyWorkStats(userId),
      getPriorityStats(userId),
      getTagStats(userId),
      getOverdueStats(userId),
      getSystemUsageStats(userId)
    ]);

    // คำนวณ insights เพิ่มเติม
    const insights = {
      most_productive_day: dailyStats.length > 0 ? 
        dailyStats.reduce((max, day) => 
          day.todos_completed > (max.todos_completed || 0) ? day : max
        ) : null,
      
      best_performing_tag: tagStats.length > 0 ? 
        tagStats.reduce((best, tag) => 
          (tag.completion_rate || 0) > (best.completion_rate || 0) ? tag : best
        ) : null,
      
      productivity_trend: weeklyStats.length >= 2 ? 
        (weeklyStats[0].completion_rate - weeklyStats[1].completion_rate) : 0
    };

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_COMPLETE_WORK_ANALYSIS_SUCCESS', {
      timestamp: new Date().toISOString()
    });

    return {
      overview,
      daily_stats: dailyStats,
      weekly_stats: weeklyStats,
      priority_stats: priorityStats,
      tag_stats: tagStats,
      overdue_stats: overdueStats,
      usage_stats: usageStats,
      insights
    };
  } catch (error) {
    await createLog(userId, 'GET_COMPLETE_WORK_ANALYSIS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึงสถิติแบบกำหนดเอง
 */
const getCustomStats = async (userId, options = {}) => {
  try {
    const {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      groupBy = 'day',
      includeCompleted = true,
      includePending = true,
      tagIds = [],
      priorityLevels = []
    } = options;

    let whereConditions = ['user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    // Add date range filter
    whereConditions.push(`created_at >= $${paramIndex}::date`);
    queryParams.push(startDate);
    paramIndex++;

    whereConditions.push(`created_at <= $${paramIndex}::date`);
    queryParams.push(endDate);
    paramIndex++;

    // Add completion status filter
    if (includeCompleted && !includePending) {
      whereConditions.push('is_completed = true');
    } else if (!includeCompleted && includePending) {
      whereConditions.push('is_completed = false');
    }

    const query = `
      SELECT 
        DATE_TRUNC('${groupBy}', created_at) as period,
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN is_completed = true THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN is_completed = false THEN 1 END) as pending_tasks,
        AVG(CASE WHEN completed_at IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (completed_at - created_at))/3600 
        END) as avg_completion_hours
      FROM todos 
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY DATE_TRUNC('${groupBy}', created_at)
      ORDER BY period
    `;

    const result = await pool.query(query, queryParams);

    await createLog(userId, 'GET_CUSTOM_STATS', {
      options,
      timestamp: new Date().toISOString()
    });

    return {
      data: result.rows,
      options,
      summary: {
        total_periods: result.rows.length,
        date_range: { start: startDate, end: endDate },
        group_by: groupBy
      }
    };

  } catch (error) {
    await createLog(userId, 'GET_CUSTOM_STATS_FAIL', {
      error: error.message,
      options,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

module.exports = {
  getMainAnalytics,
  getWorkOverview,
  getDailyWorkStats,
  getWeeklyWorkStats,
  getPriorityStats,
  getTagStats,
  getOverdueStats,
  getSystemUsageStats,
  getCompleteWorkAnalysis,
  getCustomStats,
};
