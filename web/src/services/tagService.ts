import api from './authService';
import { Tag, CreateTagRequest } from '../types/tag';

// ดึงรายการ Tags ทั้งหมดของผู้ใช้
export const getTags = async (): Promise<Tag[]> => {
  try {
    const response = await api.get('/tags');
    return response.data;
  } catch (error) {
    console.error('Error fetching tags:', error);
    throw error;
  }
};

// สร้าง Tag ใหม่
export const createTag = async (tagData: CreateTagRequest): Promise<Tag> => {
  try {
    const response = await api.post('/tags', tagData);
    return response.data;
  } catch (error) {
    console.error('Error creating tag:', error);
    throw error;
  }
};

// เชื่อม Tag เข้ากับ Todo
export const assignTagToTodo = async (todoId: string, tagId: string): Promise<void> => {
  try {
    await api.post(`/todos/${todoId}/tags`, { tagId });
  } catch (error) {
    console.error('Error assigning tag to todo:', error);
    throw error;
  }
};

// ยกเลิกการเชื่อม Tag กับ Todo
export const removeTagFromTodo = async (todoId: string, tagId: string): Promise<void> => {
  try {
    await api.delete(`/todos/${todoId}/tags/${tagId}`);
  } catch (error) {
    console.error('Error removing tag from todo:', error);
    throw error;
  }
};
