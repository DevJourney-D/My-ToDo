const pool = require('../config/database');
const { createLog } = require('./user.service');

/**
 * เพิ่ม tag ให้กับ todo
 */
const addTagToTodo = async (userId, todoId, tagId) => {
  try {
    // ตรวจสอบว่า todo และ tag เป็นของผู้ใช้คนนี้
    const todoQuery = 'SELECT * FROM public.todos WHERE id = $1 AND user_id = $2';
    const todoResult = await pool.query(todoQuery, [todoId, userId]);
    
    if (todoResult.rows.length === 0) {
      await createLog(userId, 'ADD_TAG_TO_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        reason: 'Todo not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Todo not found');
    }

    const tagQuery = 'SELECT * FROM public.tags WHERE id = $1 AND user_id = $2';
    const tagResult = await pool.query(tagQuery, [tagId, userId]);
    
    if (tagResult.rows.length === 0) {
      await createLog(userId, 'ADD_TAG_TO_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        reason: 'Tag not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag not found');
    }

    // ตรวจสอบว่า todo และ tag นี้เชื่อมต่อกันอยู่แล้วหรือไม่
    const existingQuery = 'SELECT * FROM public.todo_tags WHERE todo_id = $1 AND tag_id = $2';
    const existingResult = await pool.query(existingQuery, [todoId, tagId]);
    
    if (existingResult.rows.length > 0) {
      await createLog(userId, 'ADD_TAG_TO_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        reason: 'Tag already added to todo',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag already added to todo');
    }

    // เพิ่ม relationship
    const insertQuery = 'INSERT INTO public.todo_tags (todo_id, tag_id) VALUES ($1, $2) RETURNING *';
    const result = await pool.query(insertQuery, [todoId, tagId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'ADD_TAG_TO_TODO_SUCCESS', {
      todoId: todoId,
      tagId: tagId,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    if (!error.message.includes('not found') && !error.message.includes('already added')) {
      await createLog(userId, 'ADD_TAG_TO_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ลบ tag ออกจาก todo
 */
const removeTagFromTodo = async (userId, todoId, tagId) => {
  try {
    // ตรวจสอบว่า todo เป็นของผู้ใช้คนนี้
    const todoQuery = 'SELECT * FROM public.todos WHERE id = $1 AND user_id = $2';
    const todoResult = await pool.query(todoQuery, [todoId, userId]);
    
    if (todoResult.rows.length === 0) {
      await createLog(userId, 'REMOVE_TAG_FROM_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        reason: 'Todo not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Todo not found');
    }

    // ตรวจสอบว่า relationship มีอยู่หรือไม่
    const existingQuery = 'SELECT * FROM public.todo_tags WHERE todo_id = $1 AND tag_id = $2';
    const existingResult = await pool.query(existingQuery, [todoId, tagId]);
    
    if (existingResult.rows.length === 0) {
      await createLog(userId, 'REMOVE_TAG_FROM_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        reason: 'Tag not associated with todo',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag not associated with todo');
    }

    // ลบ relationship
    const deleteQuery = 'DELETE FROM public.todo_tags WHERE todo_id = $1 AND tag_id = $2 RETURNING *';
    const result = await pool.query(deleteQuery, [todoId, tagId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'REMOVE_TAG_FROM_TODO_SUCCESS', {
      todoId: todoId,
      tagId: tagId,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    if (!error.message.includes('not found') && !error.message.includes('not associated')) {
      await createLog(userId, 'REMOVE_TAG_FROM_TODO_FAIL', {
        todoId: todoId,
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ดึง tags ทั้งหมดของ todo
 */
const getTodoTags = async (userId, todoId) => {
  try {
    // ตรวจสอบว่า todo เป็นของผู้ใช้คนนี้
    const todoQuery = 'SELECT * FROM public.todos WHERE id = $1 AND user_id = $2';
    const todoResult = await pool.query(todoQuery, [todoId, userId]);
    
    if (todoResult.rows.length === 0) {
      await createLog(userId, 'GET_TODO_TAGS_FAIL', {
        todoId: todoId,
        reason: 'Todo not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Todo not found');
    }

    const query = `
      SELECT t.* FROM public.tags t
      INNER JOIN public.todo_tags tt ON t.id = tt.tag_id
      WHERE tt.todo_id = $1 AND t.user_id = $2
      ORDER BY t.name ASC
    `;
    const result = await pool.query(query, [todoId, userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TODO_TAGS_SUCCESS', {
      todoId: todoId,
      tagCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    if (!error.message.includes('Todo not found')) {
      await createLog(userId, 'GET_TODO_TAGS_FAIL', {
        todoId: todoId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ดึง todos ทั้งหมดที่มี tag นี้
 */
const getTodosByTag = async (userId, tagId) => {
  try {
    // ตรวจสอบว่า tag เป็นของผู้ใช้คนนี้
    const tagQuery = 'SELECT * FROM public.tags WHERE id = $1 AND user_id = $2';
    const tagResult = await pool.query(tagQuery, [tagId, userId]);
    
    if (tagResult.rows.length === 0) {
      await createLog(userId, 'GET_TODOS_BY_TAG_FAIL', {
        tagId: tagId,
        reason: 'Tag not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag not found');
    }

    const query = `
      SELECT td.* FROM public.todos td
      INNER JOIN public.todo_tags tt ON td.id = tt.todo_id
      WHERE tt.tag_id = $1 AND td.user_id = $2
      ORDER BY td.created_at DESC
    `;
    const result = await pool.query(query, [tagId, userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TODOS_BY_TAG_SUCCESS', {
      tagId: tagId,
      todoCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    if (!error.message.includes('Tag not found')) {
      await createLog(userId, 'GET_TODOS_BY_TAG_FAIL', {
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ดึง todos พร้อม tags ทั้งหมดของผู้ใช้
 */
const getTodosWithTags = async (userId) => {
  try {
    const query = `
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
    `;
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TODOS_WITH_TAGS_SUCCESS', {
      todoCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    await createLog(userId, 'GET_TODOS_WITH_TAGS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

module.exports = {
  addTagToTodo,
  removeTagFromTodo,
  getTodoTags,
  getTodosByTag,
  getTodosWithTags,
};
