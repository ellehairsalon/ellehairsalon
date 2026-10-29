'use client';
import { useState, useEffect } from 'react';

const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const tomorrow = () => new Date(Date.now() + 19 * 3600000).toISOString().slice(0, 10);
const fmt = (iso) => new Date(iso).toLocaleString('es-EC', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

const HOURS = Array.from({ length: 32 }, (_, i) => { const m = 360 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }); // 06:00 → 21:30
const MODES = [['all', 'Todo el día'], ['am', 'Toda la mañana'], ['pm', 'Toda la tarde'], ['custom', 'Personalizado']];
const dayLabel = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const span = (mode, h1, h2) => (mode === 'all' ? ['00:00', '23:59'] : mode === 'am' ? ['00:00', '13:00'] : mode === 'pm' ? ['13:00', '23:59'] : [h1, h2]);
const modeText = (mode, h1, h2) => (mode === 'all' ? 'todo el día' : mode === 'am' ? 'toda la mañana (hasta las 13:00)' : mode === 'pm' ? 'toda la tarde (desde las 13:00)' : `de ${h1} a ${h2}`);

export default function Closures() {
  const [list, setList] = useState([]);
  const [day, setDay] = useState('');
  const [multi, setMulti] = useState(false);
  const [day2, setDay2] = useState('');
  const [mode, setMode] = useState('all');
  const [h1, setH1] = useState('14:00');
  const [h2, setH2] = useState('18:00');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => fetch('/api/admin/closures').then((r) => r.json()).then((j) => setList(j.closures || []));
  useEffect(() => { load(); }, []);
  const post = async (body) => {
    const r = await fetch('/api/admin/closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, ...(await r.json()) };
  };

  const last = multi && day2 ? day2 : day;
  const customBad = mode === 'custom' && h2 <= h1;
  const rangeBad = multi && day2 && day2 < day;
  const ready = day && !customBad && !rangeBad && (!multi || day2);
  const [t1, t2] = span(mode, h1, h2);

  async function add() {
    // varios días: se cierra completo desde el primero hasta el último (todo el día)
    const m = multi ? 'all' : mode;
    const [a, z] = span(m, h1, h2);
    const j = await post({ action: 'add', starts_at: `${day}T${a}:00-05:00`, ends_at: `${last}T${z}:00-05:00`, reason });
    if (!j.ok) { setMsg(j.error); return; }
    setMsg(j.conflicts ? `Cerrado. Ojo: ya hay ${j.conflicts} cita(s) en ese horario; avísales o cancélalas.` : 'Horario cerrado ✓');
    setDay(''); setDay2(''); setMulti(false); setMode('all'); setReason(''); load();
  }

  return (
    <section className="closer">
      <p className="note">Los clientes no podrán reservar en ese tiempo. Útil para salir temprano, un día libre o vacaciones.</p>

      <div className="cl-step">1 · ¿Qué día?</div>
      <div className="chips">
        <button className={`chip${day === today() ? ' on' : ''}`} onClick={() => setDay(today())}>Hoy</button>
        <button className={`chip${day === tomorrow() ? ' on' : ''}`} onClick={() => setDay(tomorrow())}>Mañana ({new Date(tomorrow() + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).replace('.', '')})</button>
      </div>
      <label>O elige en el calendario<input type="date" min={today()} value={day} onChange={(e) => setDay(e.target.value)} /></label>
      {day && (
        <button className="lnk" onClick={() => { setMulti(!multi); setDay2(''); }}>{multi ? 'Solo este día' : '+ Cerrar varios días (vacaciones)'}</button>
      )}
      {multi && <label>Hasta el día<input type="date" min={day || today()} value={day2} onChange={(e) => setDay2(e.target.value)} /></label>}

      {day && !multi && (
        <>
          <div className="cl-step">2 · ¿Qué parte del día?</div>
          <div className="cl-modes" role="radiogroup">
            {MODES.map(([k, label]) => (
              <button key={k} role="radio" aria-checked={mode === k} className={`cl-mode${mode === k ? ' on' : ''}`} onClick={() => setMode(k)}>{label}</button>
            ))}
          </div>
          {mode === 'custom' && (
            <div className="cl-hours">
              <label>Desde<select value={h1} onChange={(e) => setH1(e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></label>
              <label>Hasta<select value={h2} onChange={(e) => setH2(e.target.value)}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></label>
            </div>
          )}
          {customBad && <p className="error">La hora final debe ser después de la inicial.</p>}
        </>
      )}
      {rangeBad && <p className="error">El último día debe ser igual o después del primero.</p>}

      {ready && (
        <p className="cl-sum">Se cerrará <b>{multi ? `del ${dayLabel(day)} al ${dayLabel(last)}, todo el día` : `${dayLabel(day)}, ${modeText(mode, h1, h2)}`}</b>.</p>
      )}
      <label>Motivo (opcional)<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cita médica, vacaciones…" /></label>
      {msg && <p className="note">{msg}</p>}
      <button className="cta" disabled={!ready} onClick={add}>Cerrar horario</button>
      {list.map((c) => (
        <div className="svc" key={c.starts_at + c.ends_at}>
          {fmt(c.starts_at)} → {fmt(c.ends_at)}{c.reason && ` · ${c.reason}`}
          <button className="ghost" style={{ marginLeft: 12 }} onClick={async () => { await post({ action: 'remove', starts_at: c.starts_at, ends_at: c.ends_at }); load(); }}>Quitar</button>
        </div>
      ))}
    </section>
  );
}
