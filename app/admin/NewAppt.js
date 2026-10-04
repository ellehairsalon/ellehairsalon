'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (iso) => new Date(iso).toLocaleString('es-EC', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});

export default function NewAppt() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [svcs, setSvcs] = useState([]);
  const [svc, setSvc] = useState('');
  const [asap, setAsap] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && !svcs.length)
      fetch('/api/admin/services').then((r) => r.json()).then((j) => setSvcs((j.services || []).filter((s) => s.is_active)));
  }, [open]);

  useEffect(() => {
    setAsap(null); setSlot(null); setSlots([]); setDate('');
    if (!svc) return;
    fetch(`/api/admin/slots?service=${svc}&asap=1`).then((r) => r.json())
      .then((j) => { setAsap(j.slot); });
  }, [svc]);

  useEffect(() => {
    if (!svc || !date) return;
    setSlot(null);
    fetch(`/api/admin/slots?service=${svc}&date=${date}`).then((r) => r.json()).then((j) => setSlots(j.slots || []));
  }, [date]);

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/admin/new', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot.now
        ? { service_id: svc, name, phone, start_now: true }
        : { service_id: svc, starts_at: slot.starts_at, name, phone, walk_in: !!slot.walk }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setOpen(false); setSvc(''); setName(''); setPhone('');
    router.refresh();
  }

  return (
    <>
      <button className="fab" aria-label="Nueva cita" onClick={() => setOpen(true)}>＋</button>
      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva cita</h2>
            <select value={svc} onChange={(e) => setSvc(e.target.value)}>
              <option value="">¿Qué servicio?</option>
              {svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min} min · ${s.price}</option>)}
            </select>

            {svc && (
              <>
                <h3>Llegó sin cita</h3>
                <button className={'row' + (slot?.now ? ' on' : '')} onClick={() => setSlot({ now: true })}>
                  <span>Empezar ahora mismo</span><span>pasa a "En atención"</span>
                </button>
                <h3>Lo antes posible</h3>
                {asap
                  ? <button className={'row' + (slot?.walk ? ' on' : '')} onClick={() => setSlot({ ...asap, walk: true })}>
                      <span>{fmt(asap.starts_at)}</span><span>en {asap.minutes} min</span>
                    </button>
                  : <p className="note">No hay huecos en los próximos días.</p>}
                <h3>O elige otro día</h3>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <div className="grid">
                  {slots.map((s) => (
                    <button key={s.starts_at} className={'chip' + (!slot?.walk && !slot?.now && slot?.starts_at === s.starts_at ? ' on' : '')}
                      onClick={() => setSlot(s)}>{s.time}{s.early && '*'}</button>
                  ))}
                </div>
                {date && slots.length === 0 && <p className="note">No hay horarios libres ese día.</p>}
              </>
            )}

            {slot && (
              <>
                <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09XXXXXXXX" /></label>
                {err && <p className="error">{err}</p>}
                <div className="actions">
                  <button className="cta" disabled={busy || name.trim().length < 2 || phone.length < 9} onClick={save}>
                    {busy ? 'Guardando…' : slot.now ? 'Empezar ahora' : 'Agendar'}
                  </button>
                  <button className="ghost" onClick={() => setOpen(false)}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
