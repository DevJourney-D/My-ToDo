'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Component นี้จะทำหน้าที่เป็น "ประตู" ที่ส่งผู้ใช้ไปยังหน้า login ทันที
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // สั่งให้เปลี่ยนหน้าไปที่ /login ทันทีที่ Component โหลดเสร็จ
    router.replace('/login');
  }, [router]);

  // ไม่ต้องแสดงผลอะไร เพราะจะถูกส่งต่อไปทันที
  // อาจจะแสดงหน้า Loading สั้นๆ ก็ได้
  return (
    <div className="flex items-center justify-center min-h-screen bg-stone-100">
      <p>Loading...</p>
    </div>
  );
}