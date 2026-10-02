'use client';
import { useState, useEffect } from 'react';

const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 19 * 3600000).toISOString().slice(0, 10);
const fmt = (iso) => new Date(iso).toLocaleString('es-EC', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

export default function Closures() {
  const [list, setList] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/admin/closures').then((r) => r.json()).then((j) => setList(j.closures || []));
  useEffect(() => { load(); }, []);
  const post = async (body) => {
    const r = await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, ...(await r.json()) };
  };

  async function add() {
    const j = await post({ action: 'add', starts_at: `${from}:00-05:00`, ends_at: `${to}:00-05:00`, reason });
    if (!j.ok) { setMsg(j.error); return; }
    setMsg(j.conflicts ? `Cerrado. Ojo: ya hay ${j.conflicts} cita(s) en ese horario; avísales o cancélalas.` : 'Horario cerrado ✓');
    setFrom(''); setTo(''); setReason(''); load();
  }

  return (
    <section>
      <h2>Cerrar horarios</h2>
      <p className="note">Los clientes no podrán reservar en ese tiempo. Útil para salir temprano, un día libre o vacaciones.</p>
      <div className="actions">
        <button className="ghost" onClick={() => { setFrom(`${today()}T00:00`); setTo(`${today()}T23:59`); }}>Hoy todo el día</button>
        <button className="ghost" onClick={() => { setFrom(`${tomorrow()}T00:00`); setTo(`${tomorrow()}T23:59`); }}>Mañana todo el día</button>
      </div>
      <label>Desde<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <label>Hasta<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      <label>Motivo (opcional)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      {msg && <p className="note">{msg}</p>}
      <button className="cta" disabled={!from || !to} onClick={add}>Cerrar horario</button>
      {list.map((c) => (
        <div className="svc" key={c.starts_at + c.ends_at}>
          {fmt(c.starts_at)} → {fmt(c.ends_at)}{c.reason && ` · ${c.reason}`}
          <button className="ghost" style={{ marginLeft: 12 }} onClick={async () => { await post({ action: 'remove', starts_at: c.starts_at, ends_at: c.ends_at }); load(); }}>Quitar</button>
        </div>
      ))}
    </section>
  );
}
