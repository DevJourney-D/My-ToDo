const pool = require('../config/database');
const { createLog } = require('./user.service');

/**
 * สร้าง todo ใหม่ พร้อม tags
 */
const createTodo = async (userId, todoData) => {
  const { text, priority = 1, due_date, tags = [] } = todoData;
  
  try {
    // เริ่ม transaction
    await pool.query('BEGIN');
    
    // สร้าง todo
    const todoQuery = `
      INSERT INTO public.todos (user_id, text, priority, due_date, is_completed, created_at, updated_at)
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING *;
    `;
    const todoValues = [userId, text, priority, due_date];
    const todoResult = await pool.query(todoQuery, todoValues);
    const newTodo = todoResult.rows[0];

    // เพิ่ม tags ถ้ามี
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        const tagQuery = `
          INSERT INTO public.todo_tags (todo_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT (todo_id, tag_id) DO NOTHING
        `;
        await pool.query(tagQuery, [newTodo.id, tagId]);
      }
    }

    // ดึงข้อมูล todo พร้อม tags
    const finalTodo = await getTodoWithTags(newTodo.id);

    await pool.query('COMMIT');

    // บันทึก log สำเร็จ
    await createLog(userId, 'CREATE_TODO_SUCCESS', {
      todoId: newTodo.id,
      text: text,
      priority: priority,
      due_date: due_date,
      tags: tags,
      timestamp: new Date().toISOString()
    });

    return finalTodo;
  } catch (error) {
    await pool.query('ROLLBACK');
    
    // บันทึก log ล้มเหลว
    await createLog(userId, 'CREATE_TODO_FAIL', {
      text: text,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึง todo พร้อม tags
 */
const getTodoWithTags = async (todoId) => {
  const query = `
    SELECT 
      t.*,
      COALESCE(
        json_agg(
          CASE 
            WHEN tag.id IS NOT NULL 
            THEN json_build_object('id', tag.id, 'name', tag.name)
            ELSE NULL 
          END
        ) FILTER (WHERE tag.id IS NOT NULL), 
        '[]'::json
      ) as tags
    FROM public.todos t
    LEFT JOIN public.todo_tags tt ON t.id = tt.todo_id
    LEFT JOIN public.tags tag ON tt.tag_id = tag.id
    WHERE t.id = $1
    GROUP BY t.id
  `;
  
  const result = await pool.query(query, [todoId]);
  return result.rows[0];
};

/**
 * ดึง todos ทั้งหมดของผู้ใช้ พร้อม tags
 */
const getUserTodos = async (userId) => {
  try {
    const query = `
      SELECT 
        t.*,
        COALESCE(
          json_agg(
            CASE 
              WHEN tag.id IS NOT NULL 
              THEN json_build_object('id', tag.id, 'name', tag.name)
              ELSE NULL 
            END
          ) FILTER (WHERE tag.id IS NOT NULL), 
          '[]'::json
        ) as tags
      FROM public.todos t
      LEFT JOIN public.todo_tags tt ON t.id = tt.todo_id
      LEFT JOIN public.tags tag ON tt.tag_id = tag.id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TODOS_SUCCESS', {
      todoCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    // บันทึก log ล้มเหลว
    await createLog(userId, 'GET_TODOS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึง todo เดียวตาม ID
 */
const getTodoById = async (userId, todoId) => {
  try {
    const query = `
      SELECT * FROM public.todos 
      WHERE id = $1 AND user_id = $2
    `;
    const result = await pool.query(query, [todoId, userId]);

    if (result.rows.length === 0) {
      await createLog(userId, 'GET_TODO_FAIL', {
        todoId: todoId,
        reason: 'Todo not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Todo not found');
    }

    const todo = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TODO_SUCCESS', {
      todoId: todoId,
      timestamp: new Date().toISOString()
    });

    return todo;
  } catch (error) {
    if (!error.message.includes('Todo not found')) {
      await createLog(userId, 'GET_TODO_FAIL', {
        todoId: todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * อัพเดท todo พร้อม tags
 */
const updateTodo = async (userId, todoId, updateData) => {
  const { text, is_completed, priority, due_date, tags } = updateData;
  
  try {
    await pool.query('BEGIN');
    
    // ตรวจสอบว่า todo มีอยู่และเป็นของผู้ใช้คนนี้
    const existingTodo = await getTodoById(userId, todoId);

    // อัปเดต todo หลัก
    const query = `
      UPDATE public.todos 
      SET text = COALESCE($1, text),
          is_completed = COALESCE($2, is_completed),
          priority = COALESCE($3, priority),
          due_date = COALESCE($4, due_date),
          updated_at = NOW()
      WHERE id = $5 AND user_id = $6
      RETURNING *;
    `;
    const values = [text, is_completed, priority, due_date, todoId, userId];

    await pool.query(query, values);

    // อัปเดต tags ถ้ามี
    if (tags !== undefined) {
      // ลบ tags เก่าทั้งหมด
      await pool.query('DELETE FROM public.todo_tags WHERE todo_id = $1', [todoId]);
      
      // เพิ่ม tags ใหม่
      if (tags.length > 0) {
        for (const tagId of tags) {
          const tagQuery = `
            INSERT INTO public.todo_tags (todo_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT (todo_id, tag_id) DO NOTHING
          `;
          await pool.query(tagQuery, [todoId, tagId]);
        }
      }
    }

    // ดึงข้อมูล todo ที่อัปเดตแล้วพร้อม tags
    const updatedTodo = await getTodoWithTags(todoId);

    await pool.query('COMMIT');

    // บันทึก log สำเร็จ
    await createLog(userId, 'UPDATE_TODO_SUCCESS', {
      todoId: todoId,
      changes: updateData,
      timestamp: new Date().toISOString()
    });

    return updatedTodo;
  } catch (error) {
    await pool.query('ROLLBACK');
    
    if (!error.message.includes('Todo not found')) {
      await createLog(userId, 'UPDATE_TODO_FAIL', {
        todoId: todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ลบ todo
 */
const deleteTodo = async (userId, todoId) => {
  try {
    // ตรวจสอบว่า todo มีอยู่และเป็นของผู้ใช้คนนี้
    const existingTodo = await getTodoById(userId, todoId);

    const query = `
      DELETE FROM public.todos 
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [todoId, userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'DELETE_TODO_SUCCESS', {
      todoId: todoId,
      deletedTodo: existingTodo,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    if (!error.message.includes('Todo not found')) {
      await createLog(userId, 'DELETE_TODO_FAIL', {
        todoId: todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ทำเครื่องหมาย todo เป็น completed/uncompleted
 */
const toggleTodoComplete = async (userId, todoId) => {
  try {
    const existingTodo = await getTodoById(userId, todoId);
    const newStatus = !existingTodo.is_completed;

    const query = `
      UPDATE public.todos 
      SET is_completed = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `;
    const result = await pool.query(query, [newStatus, todoId, userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'TOGGLE_TODO_SUCCESS', {
      todoId: todoId,
      newStatus: newStatus,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    if (!error.message.includes('Todo not found')) {
      await createLog(userId, 'TOGGLE_TODO_FAIL', {
        todoId: todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

module.exports = {
  createTodo,
  getUserTodos,
  getTodoById,
  getTodoWithTags,
  updateTodo,
  deleteTodo,
  toggleTodoComplete,
};
