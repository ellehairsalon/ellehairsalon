'use client';
import { useState, useEffect, useCallback } from 'react';

const days = Array.from({ length: 14 }, (_, i) =>
  new Date(Date.now() - 5 * 3600000 + i * 86400000).toISOString().slice(0, 10));
const dayLabel = (d) => new Date(d + 'T12:00:00Z')
  .toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (iso) => new Date(iso).toLocaleString('es-EC', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

export default function Manage({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('view'); // view | change | cancel
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (dt) => {
    const r = await fetch(`/api/cita/${token}${dt ? `?date=${dt}` : ''}`);
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return null; }
    setD(j);
    return j;
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mode !== 'change') return;
    setSlots(null); setSlot(null);
    load(date).then((j) => j && setSlots(j.slots));
  }, [mode, date, load]);

  async function act(body) {
    setBusy(true); setMsg('');
    const r = await fetch(`/api/cita/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(j.error); return; }
    setMode('view');
    await load();
  }

  if (err) return <p className="error">{err}</p>;
  if (!d) return <p className="note">Cargando…</p>;
  const a = d.appt;

  if (a.status === 'cancelled') return (
    <section><h2>Cita cancelada</h2><p>Tu cita fue cancelada. <a href="/">Agendar una nueva</a></p></section>
  );
  if (a.status !== 'confirmed') return (
    <section><h2>Esta cita ya finalizó</h2><p><a href="/">Agendar una nueva</a></p></section>
  );

  return (
    <section>
      <h2>Tu cita</h2>
      <p><strong>{a.service}</strong><br />{fmt(a.starts_at)}</p>
      <p className="note">Total: ${a.price}{a.early_fee > 0 && ` + $${a.early_fee} por horario temprano`}</p>
      {msg && <p className="error">{msg}</p>}

      {mode === 'view' && (
        <>
          <div className="actions">
            <button className="ghost" disabled={!d.canChange} onClick={() => setMode('change')}>Cambiar</button>
            <button className="ghost" onClick={() => setMode('cancel')}>Cancelar cita</button>
          </div>
          {!d.canChange && <p className="note">Para cambios con menos de {d.hours} horas, escríbenos por WhatsApp.</p>}
        </>
      )}

      {mode === 'cancel' && (
        <>
          <p>¿Seguro que quieres cancelar?{!d.canChange && ` Al faltar menos de ${d.hours} horas, se registrará como cancelación tardía.`}</p>
          <div className="actions">
            <button className="cta" disabled={busy} onClick={() => act({ action: 'cancel' })}>Sí, cancelar</button>
            <button className="ghost" onClick={() => setMode('view')}>Volver</button>
          </div>
        </>
      )}

      {mode === 'change' && (
        <>
          <h3>Nuevo día</h3>
          <div className="grid">
            {days.map((x) => (
              <button key={x} className={'chip' + (x === date ? ' on' : '')} onClick={() => setDate(x)}>{dayLabel(x)}</button>
            ))}
          </div>
          <h3>Nueva hora</h3>
          {slots === null && <p className="note">Buscando horarios…</p>}
          {slots?.length === 0 && <p className="note">No hay horarios libres este día.</p>}
          <div className="grid">
            {slots?.map((s) => (
              <button key={s.starts_at} className={'chip' + (slot?.starts_at === s.starts_at ? ' on' : '')} onClick={() => setSlot(s)}>
                {s.time}{s.early && '*'}
              </button>
            ))}
          </div>
          {slots?.some((s) => s.early) && <p className="note">* Horario temprano con recargo de ${slots.find((s) => s.early).fee}.</p>}
          <div className="actions">
            <button className="cta" disabled={!slot || busy} onClick={() => act({ action: 'reschedule', starts_at: slot.starts_at })}>Mover mi cita</button>
            <button className="ghost" onClick={() => setMode('view')}>Volver</button>
          </div>
        </>
      )}
    </section>
  );
}
