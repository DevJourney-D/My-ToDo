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
    const apiData = response.data.data;
    
    // แปลงข้อมูลจาก API ให้ตรงกับ format ที่ frontend ต้องการ
    const transformedData: AnalyticsData = {
      completionStats: [
        { name: 'Completed', value: parseInt(apiData.completed_todos) },
        { name: 'Incomplete', value: parseInt(apiData.pending_todos) }
      ],
      tasksByTag: [
        { name: 'High Priority', count: parseInt(apiData.high_priority) },
        { name: 'Medium Priority', count: parseInt(apiData.medium_priority) },
        { name: 'Low Priority', count: parseInt(apiData.low_priority) }
      ],
      totalTasks: parseInt(apiData.total_todos),
      completedTasks: parseInt(apiData.completed_todos),
      incompleteTasks: parseInt(apiData.pending_todos),
      tasksByDate: [] // จะเพิ่มข้อมูลนี้ในภายหลัง
    };
    
    return transformedData;
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับดึงสถิติการทำงานรายเดือน
export const getMonthlyStats = async (year: number, month: number): Promise<MonthlyStats> => {
  try {
    const response = await api.get(`/analytics/monthly?year=${year}&month=${month}`);
    return response.data.data;
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    throw error;
  }
};
