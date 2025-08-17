import axios from 'axios';

// กำหนด Base URL ของ API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// สร้าง axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// เพิ่ม token ให้กับ request headers อัตโนมัติ
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interface สำหรับ User
export interface User {
  id: string;
  username: string;
  email?: string;
}

// Interface สำหรับ Login Request
export interface LoginRequest {
  username: string;
  password: string;
}

// Interface สำหรับ Register Request
export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

// Interface สำหรับ Auth Response
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

// ฟังก์ชันสำหรับ Login
export const loginUser = async (credentials: LoginRequest): Promise<AuthResponse> => {
  try {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ฟังก์ชันสำหรับ Register
export const registerUser = async (userData: RegisterRequest): Promise<AuthResponse> => {
  try {
    const response = await api.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// ฟังก์ชันสำหรับตรวจสอบ token
export const verifyToken = async (): Promise<{ data: { user: User } }> => {
  try {
    const response = await api.get('/auth/verify');
    return response;
  } catch (error) {
    throw error;
  }
};

export default api;
