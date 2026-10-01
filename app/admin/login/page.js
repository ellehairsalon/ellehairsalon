'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function go() {
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }),
    });
    if (r.ok) location.href = '/admin'; else setErr((await r.json()).error);
  }
  return (
    <main>
      <h1>Panel del salón</h1>
      <label>Contraseña
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
      </label>
      {err && <p className="error">{err}</p>}
      <button className="cta" onClick={go}>Entrar</button>
    </main>
  );
}
