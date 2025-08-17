import api from './authService';

export interface CompletionStats {
  name: string;
  value: number;
}

export interface TasksByTag {
  name: string;
  count: number;
}

export interface MonthlyStats {
  year: number;
  month: number;
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  tasksPerDay: { date: string; count: number }[];
}

export interface AnalyticsData {
  completionStats: CompletionStats[];
  tasksByTag: TasksByTag[];
  totalTasks: number;
  completedTasks: number;
  incompleteTasks: number;
  tasksByDate: { date: string; count: number }[];
}

// ฟังก์ชันสำหรับดึงข้อมูล analytics
export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  try {
    const response = await api.get('/analytics');
    return response.data;
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงสถิติการทำงานรายเดือน
export const getMonthlyStats = async (year: number, month: number): Promise<MonthlyStats> => {
  try {
    const response = await api.get(`/analytics/monthly?year=${year}&month=${month}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    throw error;
  }
};
