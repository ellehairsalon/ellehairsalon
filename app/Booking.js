'use client';
import { useState, useEffect } from 'react';

const days = Array.from({ length: 14 }, (_, i) =>
  new Date(Date.now() - 5 * 3600000 + i * 86400000).toISOString().slice(0, 10));
const dayLabel = (d) => new Date(d + 'T12:00:00Z')
  .toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export default function Booking({ categories }) {
  const [svc, setSvc] = useState(null);
  const [date, setDate] = useState(days[0]);
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!svc) return;
    setSlots(null); setSlot(null);
    fetch(`/api/slots?date=${date}&service=${svc.id}`).then((r) => r.json()).then((j) => setSlots(j.slots || []));
  }, [svc, date]);

  async function book() {
    setBusy(true); setError('');
    const r = await fetch('/api/book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: svc.id, starts_at: slot.starts_at, name, phone }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setError(j.error); return; }
    setDone(j.token);
  }

  if (done) return (
    <section>
      <h2>Tu cita está confirmada</h2>
      <p>{svc.name}, {dayLabel(date)} a las {slot.time}.</p>
      {slot.early && <p className="note">* Incluye ${slot.fee} de recargo por horario temprano.</p>}
      <p>Guarda este enlace para ver, cambiar o cancelar tu cita:</p>
      <p><a href={`/cita/${done}`}>{typeof window !== 'undefined' ? window.location.origin : ''}/cita/{done}</a></p>
    </section>
  );

  return (
    <>
      <section>
        <h2>Servicio</h2>
        {categories.map((c) => (
          <div key={c.id}>
            <h3>{c.name}</h3>
            {c.services.map((s) => (
              <button key={s.id} className={'row' + (svc?.id === s.id ? ' on' : '')} onClick={() => setSvc(s)}>
                <span>{s.name}</span><span>{dur(s.duration_min)} · ${s.price}</span>
              </button>
            ))}
          </div>
        ))}
      </section>

      {svc && (
        <section>
          <h2>Día</h2>
          <div className="grid">
            {days.map((d) => (
              <button key={d} className={'chip' + (d === date ? ' on' : '')} onClick={() => setDate(d)}>{dayLabel(d)}</button>
            ))}
          </div>
          <h2>Hora</h2>
          {slots === null && <p className="note">Buscando horarios…</p>}
          {slots?.length === 0 && <p className="note">No hay horarios libres este día. Prueba con otro día.</p>}
          <div className="grid">
            {slots?.map((s) => (
              <button key={s.starts_at} className={'chip' + (slot?.starts_at === s.starts_at ? ' on' : '')} onClick={() => setSlot(s)}>
                {s.time}{s.early && '*'}
              </button>
            ))}
          </div>
          {slots?.some((s) => s.early) && (
            <p className="note">* Horario temprano con recargo de ${slots.find((s) => s.early).fee}.</p>
          )}
        </section>
      )}

      {slot && (
        <section>
          <h2>Tus datos</h2>
          <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09XXXXXXXX" autoComplete="tel" /></label>
          {error && <p className="error">{error}</p>}
          <button className="cta" disabled={busy || name.trim().length < 2 || phone.length < 9} onClick={book}>
            {busy ? 'Agendando…' : 'Confirmar cita'}
          </button>
        </section>
      )}
    </>
  );
}
