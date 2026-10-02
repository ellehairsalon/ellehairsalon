'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const START = 6, END = 20, PX = 64; // línea de tiempo 6:00–20:00, 64 px por hora
const min = (iso) => { const t = new Date(+new Date(iso) - 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const longDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' });
const COLORS = ['#f3d9e4', '#dfe8f6', '#e1efe3', '#f6ecd2', '#e7ddf3'];
const colorOf = (n = '') => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const STATUS = { completed: 'Completada', no_show: 'No vino' };

export default function DayView({ appts, isToday }) {
  const router = useRouter();
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const nowMin = min(new Date().toISOString());

  async function call(id, action, extra) {
    setBusy(true);
    const r = await fetch('/api/admin/appt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, ...extra }),
    });
    setBusy(false);
    if (!r.ok) { alert((await r.json()).error); return false; }
    router.refresh();
    return true;
  }
  async function act(a, action) {
    if (action === 'cancel' && !confirm('¿Cancelar esta cita?')) return;
    if (await call(a.id, action)) { setSel(null); setUndo(a.id); setTimeout(() => setUndo(null), 8000); }
  }

  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const first = (n) => n.split(' ')[0];

  return (
    <>
      <div className="tl" style={{ height: (END - START) * PX }}>
        {hours.map((h) => <div key={h} className="hr" style={{ top: (h - START) * PX }}><span>{h}:00</span></div>)}
        {isToday && nowMin >= START * 60 && nowMin < END * 60 && <div className="now" style={{ top: ((nowMin - START * 60) * PX) / 60 }} />}
        {appts.map((a) => {
          const s = min(a.starts_at), e = min(a.ends_at);
          return (
            <button key={a.id} className={'blk' + (a.status !== 'confirmed' ? ' done' : '')}
              style={{ top: ((s - START * 60) * PX) / 60, height: Math.max(((e - s) * PX) / 60 - 2, 30), background: colorOf(a.services.service_categories?.name) }}
              onClick={() => { setSel(a); setNote(a.notes || ''); }}>
              <b>{a.clients.full_name}</b><span>{a.services.name} · {hm(a.starts_at)}</span>
            </button>
          );
        })}
      </div>
      {appts.length === 0 && <p className="note">No hay citas este día.</p>}

      {undo && (
        <div className="snack">Hecho
          <button onClick={async () => { if (await call(undo, 'restore')) setUndo(null); }}>Deshacer</button>
        </div>
      )}

      {sel && (
        <div className="scrim" onClick={() => setSel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{sel.clients.full_name}</h2>
            <p>
              {sel.services.name} · {hm(sel.starts_at)} – {hm(sel.ends_at)}<br />
              {sel.stylists.name} · ${sel.price}{sel.early_fee > 0 && ` + $${sel.early_fee} horario temprano`}
              {STATUS[sel.status] && ` · ${STATUS[sel.status]}`}
            </p>
            <div className="actions">
              <a className="ghost" href={`https://wa.me/${sel.clients.phone.replace(/\D/g, '')}`}>WhatsApp</a>
              <a className="ghost" href={`https://wa.me/${sel.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Hola ${first(sel.clients.full_name)}, te recordamos tu cita de ${sel.services.name} el ${longDate(sel.starts_at)} a las ${hm(sel.starts_at)}. ¡Te esperamos en Elle Hair Salon!`)}`}>Recordar</a>
              <a className="ghost" href={`/admin/clientas/${sel.client_id}`}>Ficha</a>
            </div>
            <textarea rows={2} placeholder="Nota de esta visita (ej. fórmula del tinte)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="actions">
              <button className="ghost" disabled={busy} onClick={() => call(sel.id, 'note', { notes: note }).then((ok) => ok && setSel(null))}>Guardar nota</button>
            </div>
            {sel.status === 'confirmed' && (
              <div className="actions">
                <button className="cta" disabled={busy} onClick={() => act(sel, 'complete')}>Terminó</button>
                <button className="ghost" disabled={busy} onClick={() => act(sel, 'no_show')}>No vino</button>
                <button className="ghost" disabled={busy} onClick={() => act(sel, 'cancel')}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
