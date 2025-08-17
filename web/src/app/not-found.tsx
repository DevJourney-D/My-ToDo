import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">หน้าที่คุณหาไม่พบ</h2>
        <p className="text-gray-600 mb-6">ขออภัย หน้าที่คุณกำลังมองหาไม่มีอยู่</p>
        <Link
          href="/"
          className="inline-block bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition-colors"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
