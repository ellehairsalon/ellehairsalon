'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText } from '@/lib/wa';

const PX = 64; // 64 px por hora
const min = (iso) => { const t = new Date(+new Date(iso) - 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const longDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' });
const COLORS = ['#f3d9e4', '#dfe8f6', '#e1efe3', '#f6ecd2', '#e7ddf3'];
const colorOf = (n = '') => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const STATUS = { pending: 'Por confirmar', completed: 'Completada', no_show: 'No vino' };

// Citas que coinciden en el tiempo se dibujan lado a lado.
function layout(appts) {
  const items = appts.map((a) => ({ a, s: min(a.starts_at), e: min(a.ends_at) })).sort((x, y) => x.s - y.s || x.e - y.e);
  const out = []; let cluster = [], colEnds = [], clusterEnd = -1;
  const flush = () => { const cols = Math.max(1, ...cluster.map((c) => c.col + 1)); cluster.forEach((c) => out.push({ ...c, cols })); cluster = []; colEnds = []; clusterEnd = -1; };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.s);
    if (col === -1) { col = colEnds.length; colEnds.push(it.e); } else colEnds[col] = it.e;
    it.col = col; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
  }
  if (cluster.length) flush();
  return out;
}

export default function DayView({ appts, isToday, policyHours = 10, bonus }) {
  const router = useRouter();
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const nowMin = min(new Date().toISOString());
  const items = layout(appts);
  const START = Math.min(6, ...items.map((i) => Math.floor(i.s / 60)));
  const END = Math.max(20, ...items.map((i) => Math.ceil(i.e / 60)));

  async function call(id, action, extra) {
    setBusy(true);
    const r = await fetch('/api/admin/appt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, ...extra }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert(j.error || 'No se pudo completar.'); return null; }
    router.refresh();
    return j;
  }
  function showUndo(u) {
    clearTimeout(timer.current);
    setUndo(u);
    timer.current = setTimeout(() => setUndo(null), 8000);
  }
  async function act(a, action) {
    if (action === 'cancel' && !confirm('¿Cancelar esta cita?')) return;
    if (await call(a.id, action)) { setSel(null); showUndo({ id: a.id, action: 'restore' }); }
  }
  async function quick(a, action) { // Llegó / Empezar
    const j = await call(a.id, action);
    if (j) { setSel(null); showUndo({ id: a.id, action: 'revert', extra: { prev: j.prev } }); }
  }

  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const first = (n) => n.split(' ')[0];

  return (
    <>
      <div className="tl" style={{ height: (END - START) * PX }}>
        {hours.map((h) => <div key={h} className="hr" style={{ top: (h - START) * PX }}><span>{h}:00</span></div>)}
        {isToday && nowMin >= START * 60 && nowMin < END * 60 && <div className="now" style={{ top: ((nowMin - START * 60) * PX) / 60 }} />}
        {items.map(({ a, s, e, col, cols }) => (
          <button key={a.id}
            className={'blk' + (a.status === 'pending' ? ' pend' : a.status !== 'confirmed' ? ' done' : '') + (a.started_at && a.status === 'confirmed' ? ' live' : '') + (a.checked_in_at && !a.started_at ? ' here' : '')}
            style={{
              top: ((s - START * 60) * PX) / 60, height: Math.max(((e - s) * PX) / 60 - 2, 30),
              left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 6px)`, right: 'auto',
              background: colorOf(a.services.service_categories?.name),
            }}
            onClick={() => { setSel(a); setNote(a.notes || ''); }}>
            <b>{a.early_fee > 0 && '🌅 '}{a.guest_name || a.clients.full_name}</b><span>{a.services.name} · {hm(a.starts_at)}</span>
          </button>
        ))}
      </div>
      {appts.length === 0 && <p className="note">No hay citas este día.</p>}

      {undo && (
        <div className="snack">Hecho
          <button onClick={async () => { if (await call(undo.id, undo.action, undo.extra)) setUndo(null); }}>Deshacer</button>
        </div>
      )}

      {sel && (
        <div className="scrim" onClick={() => setSel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{sel.guest_name || sel.clients.full_name}</h2>
            {sel.guest_name && <p className="note" style={{ marginTop: -4 }}>Reservó {sel.clients.full_name}</p>}
            <p>
              {sel.services.name} · {hm(sel.starts_at)} – {hm(sel.ends_at)}<br />
              {sel.stylists.name} · ${sel.price}{sel.early_fee > 0 && ` + $${sel.early_fee} turno prioritario 🌅`}
              {STATUS[sel.status] && ` · ${STATUS[sel.status]}`}
              {sel.status === 'confirmed' && sel.started_at && ' · En atención'}
              {sel.status === 'confirmed' && !sel.started_at && sel.checked_in_at && ' · En espera'}
            </p>
            {sel.client_note && <div className="bday" style={{ whiteSpace: 'pre-wrap' }}><b>📝 Nota de la clienta:</b> {sel.client_note}</div>}
            {sel.clients.internal_notes && (
              <div className="bday" style={{ whiteSpace: 'pre-wrap' }}><b>Nota de la clienta:</b> {sel.clients.internal_notes}</div>
            )}
            <div className="actions">
              <a className="ghost" href={`https://wa.me/${sel.clients.phone.replace(/\D/g, '')}`}>WhatsApp</a>
              <a className="ghost" href={`https://wa.me/${sel.clients.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                `Hola ${first(sel.clients.full_name)}, te recordamos tu cita de ${sel.services.name} el ${longDate(sel.starts_at)} a las ${hm(sel.starts_at)}. ¡Te esperamos en Elle Hair Salon!`)}`}>Recordar</a>
              <a className="ghost" href={`/admin/clientas/${sel.client_id}`}>Ficha</a>
            </div>
            <textarea rows={2} placeholder="Nota de esta visita (ej. fórmula del tinte)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="actions">
              <button className="ghost" disabled={busy} onClick={() => call(sel.id, 'note', { notes: note }).then((j) => j && setSel(null))}>Guardar nota</button>
            </div>
            {sel.status === 'pending' && (
              <div className="actions">
                <a className="ghost" href="/admin/pendientes">Responder solicitud</a>
              </div>
            )}
            {sel.status === 'confirmed' && (
              <div className="actions">
                <a className="ghost" href={waLink(sel.clients.phone, confirmText(sel, window.location.origin, policyHours, sel.group_id ? appts.filter((x) => x.group_id === sel.group_id) : null, bonus))}>Reenviar confirmación</a>
              </div>
            )}
            {sel.status === 'confirmed' && (
              <div className="actions">
                {!sel.started_at && !sel.checked_in_at && <button className="ghost" disabled={busy} onClick={() => quick(sel, 'checkin')}>Llegó</button>}
                {!sel.started_at && <button className="ghost" disabled={busy} onClick={() => quick(sel, 'start')}>Empezar</button>}
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
