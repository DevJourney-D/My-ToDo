'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// สมมติว่ามี service สำหรับดึงข้อมูล analytics
import { getAnalyticsData, AnalyticsData } from '../../services/analyticsService'; 

// โครงสร้างข้อมูลจำลอง, ให้แทนที่ด้วย Type จาก API จริงของคุณ

const COLORS = ['#854d0e', '#d4d4d8']; // สีน้ำตาลเข้มสำหรับ Completed, สีเทาสำหรับ Incomplete

export default function AnalyticsPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace('/login');
        } else if (isAuthenticated) {
            // ลองเรียก API จริงก่อน
            setLoading(true);
            getAnalyticsData()
                .then((response: AnalyticsData) => {
                    setData(response);
                    setLoading(false);
                })
                .catch((error: unknown) => {
                    console.error('API error:', error);
                    // ใช้ข้อมูลจำลองเป็น fallback
                    setData({
                        completionStats: [
                            { name: 'Completed', value: 12 },
                            { name: 'Incomplete', value: 7 },
                        ],
                        tasksByTag: [
                            { name: 'Work', count: 8 },
                            { name: 'Personal', count: 5 },
                            { name: 'Shopping', count: 4 },
                            { name: 'Health', count: 2 },
                        ],
                        totalTasks: 19,
                        completedTasks: 12,
                        incompleteTasks: 7,
                        tasksByDate: [
                            { date: '2024-08-10', count: 3 },
                            { date: '2024-08-11', count: 5 },
                            { date: '2024-08-12', count: 2 },
                            { date: '2024-08-13', count: 4 },
                            { date: '2024-08-14', count: 3 },
                            { date: '2024-08-15', count: 2 },
                        ]
                    });
                    setLoading(false);
                });
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-stone-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-amber-800 mx-auto"></div>
                    <p className="mt-4 text-stone-600">Loading Analytics...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-stone-100">
                <div className="text-center">
                    <p className="text-red-600">Failed to load analytics data</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-4 px-4 py-2 bg-amber-800 text-white rounded hover:bg-amber-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-100 font-sans">
             <header className="bg-white shadow-sm">
                <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <Link href="/dashboard" className="text-amber-800 hover:underline">← Back to Dashboard</Link>
                    <h1 className="text-2xl font-bold text-stone-800">Productivity Analytics</h1>
                    <div className="w-32 text-right"></div> {/* Div ว่างๆ เพื่อจัด layout ให้สวยงาม */}
                </nav>
            </header>

            <main className="container mx-auto px-6 py-8">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                        <h3 className="text-2xl font-bold text-amber-800">{data.totalTasks}</h3>
                        <p className="text-stone-600">Total Tasks</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                        <h3 className="text-2xl font-bold text-green-600">{data.completedTasks}</h3>
                        <p className="text-stone-600">Completed</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                        <h3 className="text-2xl font-bold text-orange-600">{data.incompleteTasks}</h3>
                        <p className="text-stone-600">Incomplete</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                        <h3 className="text-2xl font-bold text-blue-600">{Math.round((data.completedTasks / data.totalTasks) * 100)}%</h3>
                        <p className="text-stone-600">Completion Rate</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Chart 1: Completion Status */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold text-stone-800 mb-4">Task Completion</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie 
                                    data={data.completionStats} 
                                    cx="50%" 
                                    cy="50%" 
                                    labelLine={false} 
                                    outerRadius={110} 
                                    fill="#8884d8" 
                                    dataKey="value" 
                                    label={({ name, percent }) => `${name} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                                >
                                    {data.completionStats.map((_entry, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Chart 2: Tasks by Tag */}
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold text-stone-800 mb-4">Tasks by Tag</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.tasksByTag} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                                <XAxis dataKey="name" stroke="#57534e" />
                                <YAxis stroke="#57534e" />
                                <Tooltip cursor={{fill: '#f5f5f4'}} />
                                <Legend />
                                <Bar dataKey="count" fill="#a16207" name="Number of Tasks" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </main>
        </div>
    );
}