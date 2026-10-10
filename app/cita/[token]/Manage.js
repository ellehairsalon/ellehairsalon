'use client';
import { useState, useEffect, useCallback } from 'react';
import { WHATSAPP } from '@/lib/config';
import { PRIORITY_NAME, money } from '@/lib/priority';

const days = Array.from({ length: 14 }, (_, i) =>
  new Date(Date.now() - 5 * 3600000 + i * 86400000).toISOString().slice(0, 10));
const dayLabel = (d) => new Date(d + 'T12:00:00Z')
  .toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (iso) => new Date(iso).toLocaleString('es-EC', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function Manage({ token }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState('view'); // view | change | cancel
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pf, setPf] = useState({ email: '', day: '', month: '' });
  const [pfMsg, setPfMsg] = useState('');
  const [pfDone, setPfDone] = useState(false);

  const load = useCallback(async (dt) => {
    const r = await fetch(`/api/cita/${token}${dt ? `?date=${dt}` : ''}`);
    const j = await r.json();
    if (!r.ok) { setErr(j.error); return null; }
    setD(j);
    return j;
  }, [token]);

  useEffect(() => { load(); }, [load]);
  // Mientras la solicitud está en revisión, la página se actualiza sola cuando el salón responde.
  const pending = d?.appt?.status === 'pending';
  useEffect(() => {
    if (!pending || mode !== 'view') return;
    const t = setInterval(() => load(), 30000);
    return () => clearInterval(t);
  }, [pending, mode, load]);
  useEffect(() => {
    if (mode !== 'change') return;
    setSlots(null); setSlot(null);
    load(date).then((j) => j && setSlots(j.slots));
  }, [mode, date, load]);

  async function post(body) {
    const r = await fetch(`/api/cita/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return { ok: r.ok, ...(await r.json()) };
  }
  async function act(body) {
    setBusy(true); setMsg('');
    const j = await post(body);
    setBusy(false);
    if (!j.ok) { setMsg(j.error); return; }
    setMode('view');
    await load();
  }
  async function saveProfile() {
    setBusy(true); setPfMsg('');
    const j = await post({ action: 'profile', email: pf.email, birthday_month: pf.month, birthday_day: pf.day });
    setBusy(false);
    if (!j.ok) { setPfMsg(j.error); return; }
    setPfDone(true);
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
      {pending ? (
        <>
          <h2>El salón está revisando tu solicitud</h2>
          <p className="note">Todavía no está confirmada. Te avisaremos por WhatsApp; esta página también se actualiza sola.</p>
        </>
      ) : <h2>Tu cita</h2>}
      {a.items?.length > 1 ? (
        <>
          <p><strong style={{ textTransform: 'capitalize' }}>{fmt(a.starts_at)}</strong></p>
          <div className="card">
            {a.items.map((x, i) => (
              <div className="crow" key={i}>
                <div>
                  <b>{x.guest_name || 'Tú'}</b>
                  <small>{x.service} · {new Date(x.starts_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' })}</small>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : <p><strong>{a.service}</strong><br />{fmt(a.starts_at)}</p>}
      <div className="pricebox">
        <div className="prow"><span>Servicios</span><span>{money(a.price)}</span></div>
        {a.early_fee > 0 && (
          <div className="prow prio-row"><span>🌅 {PRIORITY_NAME}<small>Incluye {d.bonus?.toLowerCase()}</small></span><span>+{money(a.early_fee)}</span></div>
        )}
        <div className="prow total"><span>Total</span><span>{money(+a.price + +a.early_fee)}</span></div>
      </div>
      {msg && <p className="error">{msg}</p>}

      {mode === 'view' && (
        <>
          {d.canChange && !pending && d.deadline && <p className="note">Puedes cambiarla o cancelarla hasta el {fmt(d.deadline)}.</p>}
          <div className="actions">
            <button className="ghost" disabled={!d.canChange} onClick={() => setMode('change')}>Cambiar</button>
            <button className="ghost" onClick={() => setMode('cancel')}>{pending ? 'Cancelar solicitud' : 'Cancelar cita'}</button>
          </div>
          {!d.canChange && !pending && <p className="note">Para cambios con menos de {d.hours} horas, <a href={`https://wa.me/${WHATSAPP}`}>escríbenos por WhatsApp</a>.</p>}

          {d.profile?.needs && !pfDone && !pending && (
            <div className="bday" style={{ marginTop: 28 }}>
              <strong>Completa tu perfil</strong> <span className="note">(opcional, solo esta vez)</span>
              <label>Tu cumpleaños
                <div className="grid">
                  <select value={pf.day} onChange={(e) => setPf({ ...pf, day: e.target.value })}>
                    <option value="">Día</option>
                    {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                  </select>
                  <select value={pf.month} onChange={(e) => setPf({ ...pf, month: e.target.value })}>
                    <option value="">Mes</option>
                    {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </label>
              <label>Tu correo
                <input type="email" value={pf.email} onChange={(e) => setPf({ ...pf, email: e.target.value })} autoComplete="email" />
              </label>
              {pfMsg && <p className="error">{pfMsg}</p>}
              <button className="ghost" disabled={busy || (!pf.email && !pf.day && !pf.month)} onClick={saveProfile}>Guardar</button>
              <p className="note">Solo el salón puede ver estos datos.</p>
            </div>
          )}
          {pfDone && <p className="note" style={{ marginTop: 28 }}>Gracias, guardamos tus datos ✓</p>}
        </>
      )}

      {mode === 'cancel' && (
        <>
          <p>¿Seguro que quieres cancelar?{!pending && !d.canChange && ` Al faltar menos de ${d.hours} horas, se registrará como cancelación tardía.`}</p>
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
              <button key={s.starts_at} className={'chip' + (s.early ? ' prio-chip' : '') + (slot?.starts_at === s.starts_at ? ' on' : '')} onClick={() => setSlot(s)}>
                {s.time}{s.early && <small>+{money(s.fee)}</small>}
              </button>
            ))}
          </div>
          {slots?.some((s) => s.early) && <p className="note">🌅 {PRIORITY_NAME}: los horarios con precio extra incluyen {d.bonus?.toLowerCase()}.</p>}
          <div className="actions">
            <button className="cta" disabled={!slot || busy} onClick={() => act({ action: 'reschedule', starts_at: slot.starts_at })}>{pending ? 'Cambiar mi solicitud' : 'Mover mi cita'}</button>
            <button className="ghost" onClick={() => setMode('view')}>Volver</button>
          </div>
        </>
      )}
    </section>
  );
}
