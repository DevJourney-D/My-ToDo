'use client';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404</h1>
      <p>Page Not Found</p>
      <button onClick={() => window.location.href = '/'}>Go Home</button>
    </div>
  );
}
