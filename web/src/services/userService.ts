import api from './authService';
import { User } from './authService';
import { Todo } from '../types/todo';
import { Tag } from '../types/tag';

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export interface UserData {
  user: User;
  todos: Todo[];
  tags: Tag[];
}

// ฟังก์ชันสำหรับเปลี่ยนรหัสผ่าน
export const changePassword = async (data: ChangePasswordRequest): Promise<{ message: string }> => {
  try {
    const response = await api.put('/user/password', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ฟังก์ชันสำหรับ export ข้อมูลผู้ใช้
export const exportUserData = async (): Promise<UserData> => {
  try {
    const response = await api.get('/user/export');
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ฟังก์ชันสำหรับอัพเดทข้อมูลผู้ใช้
export const updateUserProfile = async (userData: Partial<User>): Promise<User> => {
  try {
    const response = await api.put('/user/profile', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};
