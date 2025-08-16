const pool = require('../config/database');
const { createLog } = require('./user.service');

/**
 * สร้าง tag ใหม่
 */
const createTag = async (userId, tagData) => {
  const { name } = tagData;
  
  try {
    // ตรวจสอบว่า tag name นี้มีอยู่แล้วหรือไม่สำหรับผู้ใช้คนนี้
    const existingQuery = 'SELECT * FROM public.tags WHERE user_id = $1 AND name = $2';
    const existingResult = await pool.query(existingQuery, [userId, name]);
    
    if (existingResult.rows.length > 0) {
      await createLog(userId, 'CREATE_TAG_FAIL', {
        name: name,
        reason: 'Tag already exists',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag already exists');
    }

    const query = `
      INSERT INTO public.tags (user_id, name, created_at)
      VALUES ($1, $2, NOW())
      RETURNING *;
    `;
    const values = [userId, name];

    const result = await pool.query(query, values);
    const newTag = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'CREATE_TAG_SUCCESS', {
      tagId: newTag.id,
      name: name,
      timestamp: new Date().toISOString()
    });

    return newTag;
  } catch (error) {
    if (!error.message.includes('Tag already exists')) {
      await createLog(userId, 'CREATE_TAG_FAIL', {
        name: name,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ดึง tags ทั้งหมดของผู้ใช้
 */
const getUserTags = async (userId) => {
  try {
    const query = `
      SELECT * FROM public.tags 
      WHERE user_id = $1 
      ORDER BY name ASC
    `;
    const result = await pool.query(query, [userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TAGS_SUCCESS', {
      tagCount: result.rows.length,
      timestamp: new Date().toISOString()
    });

    return result.rows;
  } catch (error) {
    // บันทึก log ล้มเหลว
    await createLog(userId, 'GET_TAGS_FAIL', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

/**
 * ดึง tag เดียวตาม ID
 */
const getTagById = async (userId, tagId) => {
  try {
    const query = `
      SELECT * FROM public.tags 
      WHERE id = $1 AND user_id = $2
    `;
    const result = await pool.query(query, [tagId, userId]);

    if (result.rows.length === 0) {
      await createLog(userId, 'GET_TAG_FAIL', {
        tagId: tagId,
        reason: 'Tag not found',
        timestamp: new Date().toISOString()
      });
      throw new Error('Tag not found');
    }

    const tag = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'GET_TAG_SUCCESS', {
      tagId: tagId,
      timestamp: new Date().toISOString()
    });

    return tag;
  } catch (error) {
    if (!error.message.includes('Tag not found')) {
      await createLog(userId, 'GET_TAG_FAIL', {
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * อัพเดท tag
 */
const updateTag = async (userId, tagId, updateData) => {
  const { name } = updateData;
  
  try {
    // ตรวจสอบว่า tag มีอยู่และเป็นของผู้ใช้คนนี้
    const existingTag = await getTagById(userId, tagId);

    // ตรวจสอบว่าชื่อใหม่ซ้ำกับ tag อื่นหรือไม่
    if (name && name !== existingTag.name) {
      const duplicateQuery = 'SELECT * FROM public.tags WHERE user_id = $1 AND name = $2 AND id != $3';
      const duplicateResult = await pool.query(duplicateQuery, [userId, name, tagId]);
      
      if (duplicateResult.rows.length > 0) {
        await createLog(userId, 'UPDATE_TAG_FAIL', {
          tagId: tagId,
          reason: 'Tag name already exists',
          timestamp: new Date().toISOString()
        });
        throw new Error('Tag name already exists');
      }
    }

    const query = `
      UPDATE public.tags 
      SET name = COALESCE($1, name)
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `;
    const values = [name, tagId, userId];

    const result = await pool.query(query, values);
    const updatedTag = result.rows[0];

    // บันทึก log สำเร็จ
    await createLog(userId, 'UPDATE_TAG_SUCCESS', {
      tagId: tagId,
      changes: updateData,
      timestamp: new Date().toISOString()
    });

    return updatedTag;
  } catch (error) {
    if (!error.message.includes('Tag not found') && !error.message.includes('Tag name already exists')) {
      await createLog(userId, 'UPDATE_TAG_FAIL', {
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

/**
 * ลบ tag
 */
const deleteTag = async (userId, tagId) => {
  try {
    // ตรวจสอบว่า tag มีอยู่และเป็นของผู้ใช้คนนี้
    const existingTag = await getTagById(userId, tagId);

    const query = `
      DELETE FROM public.tags 
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;
    const result = await pool.query(query, [tagId, userId]);

    // บันทึก log สำเร็จ
    await createLog(userId, 'DELETE_TAG_SUCCESS', {
      tagId: tagId,
      deletedTag: existingTag,
      timestamp: new Date().toISOString()
    });

    return result.rows[0];
  } catch (error) {
    if (!error.message.includes('Tag not found')) {
      await createLog(userId, 'DELETE_TAG_FAIL', {
        tagId: tagId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    throw error;
  }
};

module.exports = {
  createTag,
  getUserTags,
  getTagById,
  updateTag,
  deleteTag,
};
