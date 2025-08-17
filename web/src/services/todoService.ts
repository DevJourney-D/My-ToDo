import api from './authService';
import { Todo, CreateTodoRequest, UpdateTodoRequest } from '../types/todo';

// ดึงรายการ Todos ทั้งหมดของผู้ใช้
export const getTodos = async (): Promise<Todo[]> => {
  try {
    const response = await api.get('/todos');
    return response.data;
  } catch (error) {
    console.error('Error fetching todos:', error);
    throw error;
  }
};

// สร้าง Todo ใหม่
export const createTodo = async (todoData: CreateTodoRequest): Promise<Todo> => {
  try {
    const response = await api.post('/todos', todoData);
    return response.data;
  } catch (error) {
    console.error('Error creating todo:', error);
    throw error;
  }
};

// อัพเดท Todo
export const updateTodo = async (todoId: string, updateData: UpdateTodoRequest): Promise<Todo> => {
  try {
    const response = await api.patch(`/todos/${todoId}`, updateData);
    return response.data;
  } catch (error) {
    console.error('Error updating todo:', error);
    throw error;
  }
};

// ลบ Todo
export const deleteTodo = async (todoId: string): Promise<void> => {
  try {
    await api.delete(`/todos/${todoId}`);
  } catch (error) {
    console.error('Error deleting todo:', error);
    throw error;
  }
};

// สลับสถานะ complete ของ Todo
export const toggleComplete = async (todoId: string): Promise<Todo> => {
  try {
    const response = await api.patch(`/todos/${todoId}/toggle`);
    return response.data;
  } catch (error) {
    console.error('Error toggling todo:', error);
    throw error;
  }
};
