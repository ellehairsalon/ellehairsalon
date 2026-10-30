'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { followText } from '@/lib/wa';

const usd = (n) => `$${(Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0 })}`;
const waLink = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, '').replace(/^0/, '593')}?text=${encodeURIComponent(text)}`;
const when = (days) => days > 0 ? `Hace ${days === 1 ? '1 día' : days < 14 ? `${days} días` : `${Math.round(days / 7)} semanas`} que le toca` : days === 0 ? 'Le toca hoy' : `Le toca en ${-days} ${-days === 1 ? 'día' : 'días'}`;

export default function Follow({ data, origin, months, paid, low }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [undo, setUndo] = useState(null);
  const todo = data.items.filter((i) => !i.contacted);
  const waiting = data.items.filter((i) => i.contacted);
  const cur = months[months.length - 1];
  const max = Math.max(1, ...months.map((x) => paid ? x.total : x.n));

  async function act(i, action) {
    setBusy(i.client_id); setMsg('');
    const r = await fetch('/api/admin/followup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: i.client_id, appt_id: i.appt_id, action }) });
    setBusy('');
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error || 'No se pudo guardar.'); return; }
    setUndo(action === 'undo' ? null : { i, label: action === 'dismissed' ? `${i.name.split(' ')[0]}: no se le volverá a avisar.` : `Listo, ${i.name.split(' ')[0]} quedó en espera de respuesta.` });
    router.refresh();
  }
  const card = (i, waitingCard) => (
    <div key={i.client_id} className={`fu ${i.days > 0 ? 'late' : ''}`}>
      <a className="fu-head" href={`/admin/clientas/${i.client_id}`}>
        <span className="avatar">{i.name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</span>
        <span className="li-main"><b>{i.name}</b><small>{i.service}{i.others.length > 0 && ` + ${i.others.length} más`}</small></span>
      </a>
      <p className="fu-when">{when(i.days)} · cada {i.weeks} sem.</p>
      <div className="fu-btns">
        <a className="btn wa" href={waLink(i.phone, followText(i, origin))} target="_blank" rel="noopener noreferrer" onClick={() => !waitingCard && act(i, 'contacted')}>Escribir por WhatsApp</a>
        {waitingCard
          ? <button className="btn soft sm" disabled={busy === i.client_id} onClick={() => act(i, 'undo')}>Volver a la lista</button>
          : <button className="btn soft sm" disabled={busy === i.client_id} onClick={() => act(i, 'contacted')}>Ya la contacté</button>}
        <button className="btn tint sm" disabled={busy === i.client_id} onClick={() => act(i, 'dismissed')}>No volverá</button>
      </div>
    </div>
  );

  return (
    <main className="wide">
      <h1>Clientes</h1>
      <nav className="seg"><a className="on" href="/admin/seguimiento">Seguimiento{data.count > 0 && <i className="badge">{data.count}</i>}</a><a href="/admin/clientas">Todos</a></nav>

      <div className="kpis">
        <div className="kpi"><b>{data.count}</b><span>Por contactar</span></div>
        <div className="kpi"><b>{paid ? usd(cur.total) : cur.n}</b><span>{paid ? 'Cobrado este mes' : 'Citas este mes'}</span></div>
        <div className="kpi"><b>{cur.n}</b><span>Citas del mes</span></div>
        <a className="kpi" href="/admin/inventario"><b>{low}</b><span>Por reponer</span></a>
      </div>

      <section className="bars" aria-label="Últimos 6 meses">
        <h2>{paid ? 'Cobrado por mes' : 'Citas por mes'}</h2>
        <div className="bars-row">
          {months.map((x, k) => { const v = paid ? x.total : x.n; return (
            <div key={x.key} className="bar-col"><small>{v > 0 ? (paid ? usd(v) : v) : ''}</small><div className="bar-t"><div className={`mbar ${k === 5 ? 'cur' : ''}`} style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%` }} /></div><em>{x.label}</em></div>
          ); })}
        </div>
        {!paid && <p className="note">Para ver cuánto se cobra por mes, corre migration-15.sql en Supabase.</p>}
      </section>

      {!data.supported ? (
        <div className="empty"><div className="empty-ico">🔔</div><b>Falta un paso en Supabase</b><span>Corre migration-16.sql para activar el seguimiento de clientes.</span></div>
      ) : (<>
        <h2 className="fu-h">Les toca volver</h2>
        {msg && <p className="err">{msg}</p>}
        {todo.length === 0
          ? <div className="empty"><div className="empty-ico">🎉</div><b>Todo al día</b><span>Nadie pendiente por contactar. Elige “Volver cada” en Ajustes › Servicios para ajustar los tiempos.</span></div>
          : <div className="fu-list">{todo.map((i) => card(i, false))}</div>}
        {waiting.length > 0 && (<><h2 className="fu-h">Esperando respuesta</h2><div className="fu-list">{waiting.map((i) => card(i, true))}</div></>)}
      </>)}
      {undo && <div className="snack"><span>{undo.label}</span><button onClick={() => act(undo.i, 'undo')}>Deshacer</button></div>}
    </main>
  );
}
