'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText } from '@/lib/wa';
import { svcEmoji } from '@/lib/emoji';

const PX = 64; // 64 px por hora
const min = (iso) => { const t = new Date(+new Date(iso) - 5 * 3600000); return t.getUTCHours() * 60 + t.getUTCMinutes(); };
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' });
const longDate = (iso) => new Date(iso).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Guayaquil' });
const COLORS = ['#f3d9e4', '#dfe8f6', '#e1efe3', '#f6ecd2', '#e7ddf3'];
const colorOf = (n = '') => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
const METHODS = [['efectivo', '💵 Efectivo'], ['transferencia', '🏦 Transferencia'], ['tarjeta', '💳 Tarjeta'], ['otro', 'Otro']];
const METHOD_NAME = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', otro: 'Otro' };
const usd = (n) => `$${(+n).toFixed(2).replace(/\.00$/, '')}`;
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

export default function DayView({ appts, isToday, date, policyHours = 10, bonus, lunch }) {
  const router = useRouter();
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [undo, setUndo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState(null); // ventana de cobro: { a, amount, method, edit }
  const timer = useRef(null);
  const [ghost, setGhost] = useState(null); // vista previa de la cita que se está agendando
  const [hover, setHover] = useState(null); // minuto del hueco bajo el mouse
  const [drag, setDrag] = useState(null); // { id, mode: 'move'|'resize', mins } mientras Elena arrastra una cita
  const dragRef = useRef(null);
  const wasDrag = useRef(false);
  useEffect(() => {
    const on = (e) => setGhost(e.detail && e.detail.date === date ? e.detail : null);
    window.addEventListener('elle:preview', on);
    return () => window.removeEventListener('elle:preview', on);
  }, [date]);
  const nowMin = min(new Date().toISOString());
  const items = layout(appts);
  const START = Math.min(6, ...items.map((i) => Math.floor(i.s / 60)), ...(ghost ? [Math.floor(ghost.s / 60)] : []));
  const END = Math.max(20, ...items.map((i) => Math.ceil(i.e / 60)), ...(ghost ? [Math.ceil(ghost.e / 60)] : []));

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

  // Al tocar "Terminó" se pregunta cuánto cobró Elena (viene escrito el precio de lista) y cómo le pagaron.
  function openPay(a, edit = false) {
    let method = 'efectivo';
    try { method = localStorage.getItem('elle_pay_method') || 'efectivo'; } catch {}
    const list = +a.price + +a.early_fee;
    const amount = edit && a.paid_amount != null ? String(a.paid_amount) : list > 0 ? String(Math.round(list * 100) / 100) : '';
    setPay({ a, amount, method: edit && a.paid_method ? a.paid_method : method, edit, list });
    setSel(null);
  }
  async function savePay(skip = false) {
    const { a, amount, method, edit } = pay;
    const body = skip ? {} : { amount, method };
    if (!skip && (amount === '' || Number.isNaN(+amount) || +amount < 0)) { alert('Escribe cuánto cobraste (puede ser 0).'); return; }
    const j = await call(a.id, edit ? 'pay' : 'complete', body);
    if (!j) return;
    try { if (!skip) localStorage.setItem('elle_pay_method', method); } catch {}
    setPay(null);
    if (!edit) showUndo({ id: a.id, action: 'restore' });
    if (j.paidSaved === false) alert('La cita se terminó, pero el cobro no se guardó: falta correr migration-15.sql en Supabase.');
  }

  // Arrastrar con el mouse: mover la cita (de a 15 min) o estirar su final para cambiar la duración
  const SNAP = 15, PXM = PX / 60;
  const canDrag = (a) => a.status === 'confirmed' && !a.started_at;
  const isLastOfGroup = (a) => !a.group_id || appts.filter((x) => x.group_id === a.group_id).every((x) => +new Date(x.starts_at) <= +new Date(a.starts_at));
  function dragStart(e, a, mode) {
    if (!canDrag(a) || e.button !== 0 || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
    if (mode === 'resize') e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { id: a.id, mode, y0: e.clientY, moved: false, mins: 0 };
  }
  function dragMove(e, a) {
    const d = dragRef.current;
    if (!d || d.id !== a.id) return;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true; d.mins = Math.round(dy / PXM / SNAP) * SNAP;
    setDrag({ id: a.id, mode: d.mode, mins: d.mins });
  }
  async function dragEnd(a) {
    const d = dragRef.current; dragRef.current = null;
    if (!d || d.id !== a.id || !d.moved) return;
    wasDrag.current = true; setTimeout(() => { wasDrag.current = false; }, 0); // el soltar no cuenta como un toque
    setDrag(null);
    if (!d.mins) return;
    if (d.mode === 'move') {
      const j = await call(a.id, 'move', { shift_min: d.mins });
      if (j && !j.same) showUndo({ id: a.id, action: 'undo_move', extra: { prev: j.prev }, label: 'Cita movida. El aviso para el cliente quedó en Pendientes.' });
    } else {
      const j = await call(a.id, 'resize', { ends_at: new Date(+new Date(a.ends_at) + d.mins * 60000).toISOString() });
      if (j) showUndo({ id: a.id, action: 'undo_move', extra: { prev: j.prev }, label: 'Duración cambiada.' });
    }
  }

  const hours = Array.from({ length: END - START }, (_, i) => START + i);
  const first = (n) => n.split(' ')[0];

  return (
    <>
      <div className="tl" style={{ height: (END - START) * PX }}
        onMouseMove={(e) => { if (e.target.closest('.blk')) { setHover(null); return; } const y = e.clientY - e.currentTarget.getBoundingClientRect().top; setHover(Math.floor(((y / PX) * 60 + START * 60) / 30) * 30); }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { if (e.target.closest('.blk')) return; const y = e.clientY - e.currentTarget.getBoundingClientRect().top; const m = Math.floor(((y / PX) * 60 + START * 60) / 30) * 30; window.dispatchEvent(new CustomEvent('elle:new', { detail: { date, min: m } })); }}>
        {hover !== null && !ghost && <div className="tl-hover" style={{ top: ((hover - START * 60) * PX) / 60, height: PX / 2 }}><span>＋ Agendar {String(Math.floor(hover / 60)).padStart(2, '0')}:{String(hover % 60).padStart(2, '0')}</span></div>}
        {ghost && <div className="blk ghost" style={{ top: ((ghost.s - START * 60) * PX) / 60 + 2, height: Math.max(((ghost.e - ghost.s) * PX) / 60 - 5, 30), left: '4px', width: 'calc(100% - 6px)', right: 'auto' }}><b>{ghost.label}</b><span>{String(Math.floor(ghost.s / 60)).padStart(2, '0')}:{String(ghost.s % 60).padStart(2, '0')} · nueva cita</span></div>}
        {lunch && lunch.e > START * 60 && lunch.s < END * 60 && <div className="lunch" style={{ top: ((Math.max(lunch.s, START * 60) - START * 60) * PX) / 60, height: ((Math.min(lunch.e, END * 60) - Math.max(lunch.s, START * 60)) * PX) / 60 }}><span>🍽️ Almuerzo</span></div>}
        {hours.map((h) => <div key={h} className="hr" style={{ top: (h - START) * PX }}><span>{h}:00</span></div>)}
        {isToday && nowMin >= START * 60 && nowMin < END * 60 && <div className="now" style={{ top: ((nowMin - START * 60) * PX) / 60 }} />}
        {items.map(({ a, s, e, col, cols }) => (
          <button key={a.id}
            className={'blk' + (a.status === 'pending' ? ' pend' : a.status !== 'confirmed' ? ' done' : '') + (a.started_at && a.status === 'confirmed' ? ' live' : '') + (a.checked_in_at && !a.started_at ? ' here' : '') + (a.early || a.early_fee > 0 ? ' prio' : '') + (((e - s) * PX) / 60 - 5 < 56 ? ' short' : '') + (canDrag(a) ? ' canmove' : '') + (drag?.id === a.id ? ' dragging' : '')}
            style={{
              top: ((s - START * 60) * PX) / 60 + 2, height: Math.max(((e - s) * PX) / 60 - 5 + (drag?.id === a.id && drag.mode === 'resize' ? drag.mins * PXM : 0), 30),
              ...(drag?.id === a.id && drag.mode === 'move' ? { transform: `translateY(${drag.mins * PXM}px)` } : {}),
              left: `calc(${(col / cols) * 100}% + 4px)`, width: `calc(${100 / cols}% - 6px)`, right: 'auto',
              ...(a.early || a.early_fee > 0 ? {} : { background: colorOf(a.services.service_categories?.name) }),
            }}
            onPointerDown={(e) => dragStart(e, a, 'move')} onPointerMove={(e) => dragMove(e, a)} onPointerUp={() => dragEnd(a)} onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
            onClick={() => { if (wasDrag.current) return; setSel(a); setNote(a.notes || ''); }}>
            <b>{a.guest_name || a.clients.full_name}{(a.early || a.early_fee > 0) && ' 🌅'}{a.change_starts_at && ' ⏳'}</b><span>{svcEmoji(a.services.name, a.services.service_categories?.name)} {a.services.name} · {drag?.id === a.id && drag.mode === 'move' ? <u>{hm(new Date(+new Date(a.starts_at) + drag.mins * 60000).toISOString())}</u> : drag?.id === a.id ? <u>{hm(a.starts_at)}–{hm(new Date(+new Date(a.ends_at) + drag.mins * 60000).toISOString())}</u> : hm(a.starts_at)}</span>
            {canDrag(a) && isLastOfGroup(a) && <i className="rz" aria-hidden="true" onPointerDown={(e) => dragStart(e, a, 'resize')} />}
          </button>
        ))}
      </div>
      {appts.length === 0 && <p className="note">No hay citas este día.</p>}

      {undo && (
        <div className="snack">{undo.label || 'Hecho'}
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
              {st === 'completed' && (
                <div className="m-pay">
                  <span>{sel.paid_amount != null ? <>💵 Cobrado <b>{usd(sel.paid_amount)}</b> · {METHOD_NAME[sel.paid_method] || 'Efectivo'}</> : 'Sin cobro registrado'}</span>
                  <button className="btn soft sm" onClick={() => openPay(sel, true)}>{sel.paid_amount != null ? 'Corregir' : 'Registrar cobro'}</button>
                </div>
              )}
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
                  <button className="btn primary" disabled={busy} onClick={() => openPay(sel)}>✓ Terminó</button>
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
      {pay && (
        <div className="modal-scrim" onClick={() => setPay(null)}>
          <div className="modal pay-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setPay(null)} aria-label="Cerrar">✕</button>
            <h2>{pay.edit ? 'Cobro de la cita' : '¿Cuánto cobraste?'}</h2>
            <p className="pay-who">{pay.a.guest_name || pay.a.clients.full_name} · {pay.a.services.name}</p>
            <label className="pay-amt" htmlFor="pay-amount">
              <span>$</span>
              <input id="pay-amount" inputMode="decimal" autoFocus value={pay.amount} placeholder="0" onChange={(e) => setPay({ ...pay, amount: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') })} />
            </label>
            {pay.list > 0 && +pay.amount !== pay.list && (
              <button className="lnk pay-list" onClick={() => setPay({ ...pay, amount: String(Math.round(pay.list * 100) / 100) })}>Usar el precio de lista: {usd(pay.list)}</button>
            )}
            {pay.list === 0 && !pay.amount && <p className="note">Esta cita no tiene precio de lista: escribe lo que cobraste.</p>}
            <div className="pay-methods" role="radiogroup" aria-label="Forma de pago">
              {METHODS.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={pay.method === k} className={'pill' + (pay.method === k ? ' on' : '')} onClick={() => setPay({ ...pay, method: k })}>{label}</button>
              ))}
            </div>
            <button className="btn primary full" disabled={busy} onClick={() => savePay(false)}>{pay.edit ? 'Guardar cobro' : 'Guardar y terminar cita'}</button>
            {!pay.edit && <button className="lnk pay-skip" disabled={busy} onClick={() => savePay(true)}>Terminar sin registrar el cobro</button>}
          </div>
        </div>
      )}
    </>
  );
}
