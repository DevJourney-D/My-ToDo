'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
// สมมติว่ามี service สำหรับจัดการ user data
import { changePassword, exportUserData } from '../../services/userService';

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
    const { user } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        setMessage(null);
        try {
            await changePassword({ oldPassword, newPassword });
            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setOldPassword('');
            setNewPassword('');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error && 'response' in error && 
                typeof error.response === 'object' && error.response !== null &&
                'data' in error.response && 
                typeof error.response.data === 'object' && error.response.data !== null &&
                'message' in error.response.data
                ? String(error.response.data.message)
                : 'Failed to change password.';
            setMessage({ type: 'error', text: errorMessage });
        }
    };
    
    const handleExport = async () => {
        try {
            const response = await exportUserData();
            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            if (typeof window !== 'undefined') {
                const a = document.createElement('a');
                a.href = url;
                a.download = 'my_todo_data.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
            
            URL.revokeObjectURL(url);
            setMessage({ type: 'success', text: 'Data exported successfully!' });
        } catch {
            setMessage({ type: 'error', text: 'Failed to export data.' });
        }
    };

    return (
        <div className="min-h-screen bg-stone-100 p-8 font-sans">
             <header className="mb-8">
                <Link href="/dashboard" className="text-amber-800 hover:underline">← Back to Dashboard</Link>
            </header>
            <div className="max-w-2xl mx-auto">
                <h1 className="text-4xl font-bold text-stone-800 mb-8">Profile & Settings</h1>
                
                <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
                    <h2 className="text-2xl font-bold text-stone-800 mb-4">User Information</h2>
                    <div className="space-y-2 text-stone-600">
                        <p><strong>Username:</strong> {user?.username}</p>
                        <p><strong>User ID:</strong> <span className="text-xs bg-stone-200 p-1 rounded font-mono">{user?.id}</span></p>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg mb-8">
                    <h2 className="text-2xl font-bold text-stone-800 mb-4">Change Password</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Old Password" required className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition"/>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" required className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-700 focus:border-amber-700 transition"/>
                        <button type="submit" className="w-full py-3 font-semibold text-white bg-stone-800 rounded-lg hover:bg-stone-900 transition">Update Password</button>
                        {message && (
                            <p className={`text-sm text-center ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {message.text}
                            </p>
                        )}
                    </form>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-stone-800 mb-4">Data Management</h2>
                    <button onClick={handleExport} className="w-full py-3 font-semibold text-amber-900 bg-amber-200 rounded-lg hover:bg-amber-300 transition">
                        Export My Data (.json)
                    </button>
                </div>
            </div>
        </div>
    );
}
