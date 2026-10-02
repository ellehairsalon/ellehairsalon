'use client';
import { useState } from 'react';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function BirthdayForm({ id, month, day }) {
  const [m, setM] = useState(month || '');
  const [d, setD] = useState(day || '');
  const [msg, setMsg] = useState('');
  async function save() {
    const r = await fetch('/api/admin/client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, birthday_month: m, birthday_day: d }),
    });
    setMsg(r.ok ? 'Guardado ✓' : 'No se pudo guardar');
  }
  return (
    <div className="grid">
      <select value={d} onChange={(e) => setD(e.target.value)}><option value="">Día</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select>
      <select value={m} onChange={(e) => setM(e.target.value)}><option value="">Mes</option>{MESES.map((x, i) => <option key={x} value={i + 1}>{x}</option>)}</select>
      <button className="ghost" onClick={save}>Guardar cumpleaños</button>
      <span className="note">{msg}</span>
    </div>
  );
}
