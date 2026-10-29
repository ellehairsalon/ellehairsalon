'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText } from '@/lib/wa';
import { svcEmoji } from '@/lib/emoji';

const PX = 64; // 64 px por hora
const min = (iso) => { const t = new Date(+new Date(iso) - 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' });
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
            className={'blk' + (a.status === 'pending' ? ' pend' : a.status !== 'confirmed' ? ' done' : '') + (a.started_at && a.status === 'confirmed' ? ' live' : '') + (a.checked_in_at && !a.started_at ? ' here' : '') + (a.early || a.early_fee > 0 ? ' prio' : '')}
            style={{
              top: ((s - START * 60) * PX) / 60 + 2, height: Math.max(((e - s) * PX) / 60 - 5, 30),
              left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 6px)`, right: 'auto',
              ...(a.early || a.early_fee > 0 ? {} : { background: colorOf(a.services.service_categories?.name) }),
            }}
            onClick={() => { setSel(a); setNote(a.notes || ''); }}>
            <b>{a.guest_name || a.clients.full_name}{(a.early || a.early_fee > 0) && ' 🌅'}{a.change_starts_at && ' ⏳'}</b><span>{svcEmoji(a.services.name, a.services.service_categories?.name)} {a.services.name} · {hm(a.starts_at)}</span>
          </button>
        ))}
      </div>
      {appts.length === 0 && <p className="note">No hay citas este día.</p>}

      {undo && (
        <div className="snack">Hecho
          <button onClick={async () => { if (await call(undo.id, undo.action, undo.extra)) setUndo(null); }}>Deshacer</button>
        </div>
      )}

      {sel && (() => {
        const wa = `https://wa.me/${sel.clients.phone.replace(/\D/g, '')}`;
        const st = sel.status;
        const live = sel.started_at && st === 'confirmed';
        const here = !live && sel.checked_in_at && st === 'confirmed';
        return (
          <div className="modal-scrim" onClick={() => setSel(null)}>
            <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <button className="modal-x" onClick={() => setSel(null)} aria-label="Cerrar">✕</button>
              <div className="m-head">
                <span className="m-emo">{svcEmoji(sel.services.name, sel.services.service_categories?.name)}</span>
                <div>
                  <h2>{sel.guest_name || sel.clients.full_name}</h2>
                  {sel.guest_name && <small>Reservó {sel.clients.full_name}</small>}
                </div>
              </div>
              <div className="m-chips">
                <span className="m-chip">{sel.services.name}</span>
                <span className="m-chip">🕒 {hm(sel.starts_at)} – {hm(sel.ends_at)}</span>
                <span className="m-chip">{sel.stylists.name}</span>
                {(sel.early || sel.early_fee > 0) && <span className="m-chip gold">🌅 Turno prioritario</span>}
                {STATUS[st] && <span className="m-chip">{STATUS[st]}</span>}
                {live && <span className="m-chip ok">En atención</span>}
                {here && <span className="m-chip warn">En espera</span>}
              </div>
              {sel.change_starts_at && (
                <a className="m-alert" href="/admin/pendientes">⏳ Pidió cambiar su cita a {longDate(sel.change_starts_at)} a las {hm(sel.change_starts_at)}. <b>Responder →</b></a>
              )}
              {sel.client_note && <div className="m-note"><b>📝 Nota del cliente</b>{sel.client_note}</div>}
              {sel.clients.internal_notes && <div className="m-note"><b>Nota interna</b>{sel.clients.internal_notes}</div>}

              {st === 'pending' && <a className="btn primary full" href="/admin/pendientes">Responder solicitud</a>}
              {st === 'confirmed' && (
                <div className="m-row main">
                  {!sel.started_at && !sel.checked_in_at && <button className="btn tint" disabled={busy} onClick={() => quick(sel, 'checkin')}>Llegó</button>}
                  {!sel.started_at && <button className="btn tint" disabled={busy} onClick={() => quick(sel, 'start')}>Empezar</button>}
                  <button className="btn primary" disabled={busy} onClick={() => act(sel, 'complete')}>✓ Terminó</button>
                </div>
              )}

              <div className="m-grid">
                <a target="_blank" rel="noopener noreferrer" className="btn wa wide2" href={wa}>💬 Escribir por WhatsApp</a>
                <a target="_blank" rel="noopener noreferrer" className="btn soft" href={`${wa}?text=${encodeURIComponent(
                  `Hola ${first(sel.clients.full_name)}, te recordamos tu cita de ${sel.services.name} el ${longDate(sel.starts_at)} a las ${hm(sel.starts_at)}. ¡Te esperamos en Elle Hair Salon!`)}`}>Recordar cita</a>
                <a className="btn soft" href={`/admin/clientas/${sel.client_id}`}>Ficha</a>
                {st === 'confirmed' && (
                  <a target="_blank" rel="noopener noreferrer" className="btn soft wide2" href={waLink(sel.clients.phone, confirmText(sel, window.location.origin, policyHours, sel.group_id ? appts.filter((x) => x.group_id === sel.group_id) : null, bonus))}>Reenviar confirmación</a>
                )}
              </div>

              <textarea rows={2} placeholder="Nota de esta visita (ej. fórmula del tinte)" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn soft sm" disabled={busy} onClick={() => call(sel.id, 'note', { notes: note }).then((j) => j && setSel(null))}>Guardar nota</button>

              {st === 'confirmed' && (
                <div className="m-row end">
                  <button className="btn danger" disabled={busy} onClick={() => act(sel, 'no_show')}>No vino</button>
                  <button className="btn danger" disabled={busy} onClick={() => act(sel, 'cancel')}>Cancelar cita</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
