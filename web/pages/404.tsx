import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:'3rem',marginBottom:'0.5rem'}}>404</h1>
        <p style={{color:'#6b7280',marginBottom:'1rem'}}>Page not found</p>
        <Link href="/" style={{color:'#2563eb',textDecoration:'underline'}}>Go home</Link>
      </div>
    </main>
  );
}
