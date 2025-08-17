'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { getTodos, createTodo, updateTodo, deleteTodo } from '../../services/todoService';
import { getTags, createTag } from '../../services/tagService';
import { Todo } from '../../types/todo';
import { Tag } from '../../types/tag';

export const dynamic = 'force-dynamic';

// Dynamic import for SweetAlert2
const loadSwal = async () => {
  const { default: Swal } = await import('sweetalert2');
  const { default: withReactContent } = await import('sweetalert2-react-content');
  return withReactContent(Swal);
};

const PRIORITY_COLORS = {
  1: 'bg-green-100 text-green-900 border border-green-300',
  2: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
  3: 'bg-red-100 text-red-900 border border-red-300'
};

const PRIORITY_LABELS = {
  1: 'ต่ำ',
  2: 'ปานกลาง',
  3: 'สูง'
};

export default function Dashboard() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priority, setPriority] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editPriority, setEditPriority] = useState(1);
  const [editDueDate, setEditDueDate] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [showNewTagForm, setShowNewTagForm] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10; // จำนวนงานต่อหน้า

  useEffect(() => {
    console.log('Dashboard useEffect - User:', user);
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      console.log('Fetching data...');

      const todosPromise = getTodos();
      const tagsPromise = getTags();

      console.log('Making parallel requests...');
      const [todosData, tagsData] = await Promise.all([
        todosPromise,
        tagsPromise
      ]);

      console.log('Todos data:', todosData);
      console.log('Tags data:', tagsData);

      setTodos(todosData);
      setTags(tagsData);
      console.log('Data set successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้';
      console.error('Fetch error details:', err);
      setError(`เกิดข้อผิดพลาด: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      const todoData = {
        text: newTodo,
        priority,
        due_date: dueDate || null,
        tags: selectedTags
      };

      await createTodo(todoData);
      setNewTodo('');
      setSelectedTags([]);
      setPriority(1);
      setDueDate('');
      fetchData();
    } catch (err) {
      setError('ไม่สามารถเพิ่มงานได้');
      console.error('Error adding todo:', err);
    }
  };

  // ฟังก์ชันลบงาน
  const handleDeleteTodo = async (id: string) => {
    const MySwal = await loadSwal();
    const result = await MySwal.fire({
      title: 'ต้องการลบงานนี้?',
      text: 'การลบนี้ไม่สามารถยกเลิกได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await deleteTodo(id);
        setTodos(prev => prev.filter(todo => todo.id !== id));
        MySwal.fire('ลบสำเร็จ!', 'งานถูกลบแล้ว', 'success');
      } catch (error) {
        console.error('Error deleting todo:', error);
        MySwal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบงานได้', 'error');
      }
    }
  };

  const handleToggleComplete = async (id: string) => {
    try {
      // Find the current todo to get its current completion status
      const currentTodo = todos.find(todo => todo.id === id);
      if (!currentTodo) return;

      // Use updateTodo instead of toggleComplete since the endpoint might not exist
      await updateTodo(id, { is_completed: !currentTodo.is_completed });
      fetchData();
    } catch (err) {
      setError('ไม่สามารถอัปเดตสถานะได้');
      console.error('Error toggling todo:', err);
    }
  };

  const startEdit = (todo: Todo) => {
    setEditingTodo(todo.id);
    setEditText(todo.text);
    setEditTags(todo.tags?.map(tag => tag.id) || []);
    setEditPriority(todo.priority || 1);
    setEditDueDate(todo.due_date ? todo.due_date.substring(0, 10) : '');
  };

  const cancelEdit = () => {
    setEditingTodo(null);
    setEditText('');
    setEditTags([]);
    setEditPriority(1);
    setEditDueDate('');
  };

  const saveEdit = async () => {
    if (!editingTodo) return;

    try {
      const updateData = {
        text: editText,
        priority: editPriority,
        due_date: editDueDate || null,
        tags: editTags
      };

      await updateTodo(editingTodo, updateData);
      cancelEdit();
      fetchData();
    } catch (err) {
      setError('ไม่สามารถแก้ไขงานได้');
      console.error('Error updating todo:', err);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await createTag({ name: newTagName.trim() });
      setNewTagName('');
      setShowNewTagForm(false);
      fetchData(); // Refresh to get new tag
    } catch (err) {
      setError('ไม่สามารถเพิ่ม tag ได้');
      console.error('Error creating tag:', err);
    }
  };

    const handleLogout = async () => {
    const MySwal = await loadSwal();
    const result = await MySwal.fire({
      title: 'ต้องการออกจากระบบ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      logout();
      MySwal.fire('ออกจากระบบแล้ว', '', 'success');
      router.push('/login');
    }
  };

  const formatDueDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    const isPast = date < today && !isToday;

    let className = '';
    if (isPast) className = 'text-red-600';
    else if (isToday) className = 'text-orange-600';
    else if (isTomorrow) className = 'text-blue-600';

    let label = '';
    if (isToday) label = 'วันนี้';
    else if (isTomorrow) label = 'พรุ่งนี้';
    else label = date.toLocaleDateString('th-TH');

    return <span className={className}>{label}</span>;
  };

  const filteredTodos = selectedTagFilter
    ? todos.filter(todo => todo.tags?.some(tag => tag.id === selectedTagFilter))
    : todos;

  // ฟังก์ชันนับจำนวนงานใน tag
  const getTagCount = (tagId: string) => {
    return todos.filter(todo => todo.tags?.some(tag => tag.id === tagId)).length;
  };

  // คำนวณงานที่จะแสดงในแต่ละหน้า
  const paginatedTodos = filteredTodos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredTodos.length / pageSize);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">กำลังโหลด...</div>
          <div className="text-sm text-gray-500">
            User: {user ? user.username : 'ไม่พบผู้ใช้'}
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg mb-2">กำลังตรวจสอบการเข้าสู่ระบบ...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg mb-2">กรุณาเข้าสู่ระบบ</div>
          <div className="text-sm text-gray-500">กำลังเปลี่ยนหน้า...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">สวัสดี {user?.username}</p>
              <p className="text-xs text-gray-400">User ID: {user?.id}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/analytics"
                className="text-blue-600 hover:text-blue-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors"
              >
                📊 วิเคราะห์
              </Link>
              <Link
                href="/profile"
                className="text-green-600 hover:text-green-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-green-50 transition-colors"
              >
                👤 โปรไฟล์
              </Link>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Breadcrumb */}
      <div className="bg-gray-100 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 py-3 text-sm">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
              🏠 หน้าหลัก
            </Link>
            <span className="text-gray-500">/</span>
            <span className="text-gray-900 font-medium">📝 Dashboard</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Form เพิ่มงาน */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">เพิ่มงานใหม่</h2>
          <form onSubmit={handleAddTodo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                งาน
              </label>
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ระบุงานที่ต้องทำ..."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  ความสำคัญ
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value={1}>ต่ำ</option>
                  <option value={2}>ปานกลาง</option>
                  <option value={3}>สูง</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  วันครบกำหนด
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Tags
                </label>
                <div className="space-y-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && !selectedTags.includes(e.target.value)) {
                        setSelectedTags([...selectedTags, e.target.value]);
                      }
                    }}
                    className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">เลือก Tag...</option>
                    {tags.filter(tag => !selectedTags.includes(tag.id)).map(tag => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>

                  {/* แสดง selected tags */}
                  {selectedTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map(tagId => {
                        const tag = tags.find(t => t.id === tagId);
                        return tag ? (
                          <span
                            key={tagId}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900 border border-blue-300"
                          >
                            {tag.name}
                            <button
                              type="button"
                              onClick={() => setSelectedTags(selectedTags.filter(id => id !== tagId))}
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {/* ปุ่มเพิ่ม tag ใหม่ */}
                  <div className="flex gap-2">
                    {!showNewTagForm ? (
                      <button
                        type="button"
                        onClick={() => setShowNewTagForm(true)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        + เพิ่ม Tag ใหม่
                      </button>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="ชื่อ Tag..."
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          เพิ่ม
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewTagForm(false);
                            setNewTagName('');
                          }}
                          className="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-md transition-colors"
            >
              เพิ่มงาน
            </button>
          </form>
        </div>

        {/* Filter Tags */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-500">กรองตาม Tag</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTagFilter(null)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${!selectedTagFilter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              ทั้งหมด ({todos.length})
            </button>
            {tags.map(tag => {
              const count = getTagCount(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(tag.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedTagFilter === tag.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {tag.name} ({count})
                </button>
              );
            })}
          </div>
          {selectedTagFilter && (
            <div className="mt-3 text-sm text-gray-600">
              กำลังแสดงงานที่มี tag: <span className="font-semibold text-blue-600">
                {tags.find(tag => tag.id === selectedTagFilter)?.name}
              </span>
            </div>
          )}
        </div>

        {/* รายการงาน */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-500">รายการงาน ({filteredTodos.length})</h2>
          {paginatedTodos.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">ไม่มีงานในรายการ</div>
          ) : (
            paginatedTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                tags={tags}
                isEditing={editingTodo === todo.id}
                editText={editText}
                editTags={editTags}
                editPriority={editPriority}
                editDueDate={editDueDate}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDeleteTodo}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditTextChange={setEditText}
                onEditTagsChange={setEditTags}
                onEditPriorityChange={setEditPriority}
                onEditDueDateChange={setEditDueDate}
                formatDueDate={formatDueDate}
              />
            ))
          )}
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded border font-bold ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
              >
                ก่อนหน้า
              </button>
              <span className="font-bold text-blue-900">หน้า {currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded border font-bold ${currentPage === totalPages ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
              >
                ถัดไป
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-500">🚀 เมนูรวดเร็ว</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            href="/analytics"
            className="flex items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white text-xl group-hover:bg-blue-600 transition-colors">
              📊
            </div>
            <div className="ml-4">
              <h4 className="text-lg font-semibold text-gray-900">วิเคราะห์ข้อมูล</h4>
              <p className="text-sm text-gray-600">ดูสถิติและกราฟของงาน</p>
            </div>
          </Link>

          <Link
            href="/profile"
            className="flex items-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group"
          >
            <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white text-xl group-hover:bg-green-600 transition-colors">
              👤
            </div>
            <div className="ml-4">
              <h4 className="text-lg font-semibold text-gray-900">โปรไฟล์</h4>
              <p className="text-sm text-gray-600">จัดการข้อมูลส่วนตัว</p>
            </div>
          </Link>

          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0 w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center text-white text-xl">
              📝
            </div>
            <div className="ml-4">
              <h4 className="text-lg font-semibold text-gray-900">งานปัจจุบัน</h4>
              <p className="text-sm text-gray-600">คุณอยู่ที่นี่</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TodoItemProps {
  todo: Todo;
  tags: Tag[];
  isEditing: boolean;
  editText: string;
  editTags: string[];
  editPriority: number;
  editDueDate: string;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onStartEdit: (todo: Todo) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditTextChange: (text: string) => void;
  onEditTagsChange: (tags: string[]) => void;
  onEditPriorityChange: (priority: number) => void;
  onEditDueDateChange: (date: string) => void;
  formatDueDate: (date: string | null | undefined) => React.ReactElement | null;
}

function TodoItem({
  todo,
  tags,
  isEditing,
  editText,
  editTags,
  editPriority,
  editDueDate,
  onToggleComplete,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTextChange,
  onEditTagsChange,
  onEditPriorityChange,
  onEditDueDateChange,
  formatDueDate
}: TodoItemProps) {
  if (isEditing) {
    return (
      <div className="px-6 py-4 bg-blue-50 border-l-4 border-blue-500">
        <div className="space-y-4">
          <input
            type="text"
            value={editText}
            onChange={(e) => onEditTextChange(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="แก้ไขงาน..."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">ความสำคัญ</label>
              <select
                value={editPriority}
                onChange={(e) => onEditPriorityChange(Number(e.target.value))}
                className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={1}>ความสำคัญ: ต่ำ</option>
                <option value={2}>ความสำคัญ: ปานกลาง</option>
                <option value={3}>ความสำคัญ: สูง</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">วันครบกำหนด</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => onEditDueDateChange(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Tags</label>
            <div className="space-y-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !editTags.includes(e.target.value)) {
                    onEditTagsChange([...editTags, e.target.value]);
                  }
                }}
                className="w-full border-2 border-gray-300 rounded-md px-3 py-2 text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">เลือก Tag...</option>
                {tags.filter(tag => !editTags.includes(tag.id)).map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>

              {/* แสดง selected tags */}
              {editTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {editTags.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? (
                      <span
                        key={tagId}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900 border border-blue-300"
                      >
                        #{tag.name}
                        <button
                          type="button"
                          onClick={() => onEditTagsChange(editTags.filter(id => id !== tagId))}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onSaveEdit}
              className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
            >
              ✅ บันทึก
            </button>
            <button
              onClick={onCancelEdit}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium px-4 py-2 rounded-md text-sm transition-colors"
            >
              ❌ ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 flex items-center space-x-4 hover:bg-gray-50">
      <input
        type="checkbox"
        checked={todo.is_completed}
        onChange={() => onToggleComplete(todo.id)}
        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-2 border-gray-400 rounded"
      />

      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-2">
          <span className={`${todo.is_completed ? 'line-through text-gray-500' : 'text-gray-900'} font-semibold text-base`}>
            {todo.text}
          </span>

          {todo.priority && (
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${PRIORITY_COLORS[todo.priority as keyof typeof PRIORITY_COLORS]}`}>
              {PRIORITY_LABELS[todo.priority as keyof typeof PRIORITY_LABELS]}
            </span>
          )}

          {todo.due_date && (
            <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded border border-gray-300 text-gray-500">
              ครบกำหนด: {formatDueDate(todo.due_date)}
            </span>
          )}
        </div>

        {todo.tags && todo.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {todo.tags.map(tag => (
              <span
                key={tag.id}
                className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-900 border border-blue-300"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex space-x-3">
        <button
          onClick={() => onStartEdit(todo)}
          className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-medium px-3 py-1 rounded text-sm border border-blue-300 transition-colors"
        >
          ✏️ แก้ไข
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="bg-red-100 hover:bg-red-200 text-red-800 font-medium px-3 py-1 rounded text-sm border border-red-300 transition-colors"
        >
          🗑️ ลบ
        </button>
      </div>
    </div>
  );
}
