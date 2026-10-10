'use client';
import { useState, useEffect, useRef } from 'react';
import { WHATSAPP } from '@/lib/config';
import { PRIORITY_NAME, DEFAULT_BONUS, money, feeTag } from '@/lib/priority';

const TZ = 'America/Guayaquil';
const todayStr = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(+new Date(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const longDay = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dow = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
const dayNum = (d) => +d.slice(8, 10);
const monthOf = (d) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { month: 'long', timeZone: 'UTC' });
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const deadlineText = (iso, hours) => new Date(+new Date(iso) - hours * 3600000).toLocaleString('es-EC', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
});

const deadlineShort = (iso, hours) => new Date(+new Date(iso) - hours * 3600000).toLocaleString('es-EC', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ,
}).replace(/\./g, '');

const hmLocal = (ms) => new Date(ms).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const MAX_PEOPLE = 5;

export default function Booking({ categories, review = true, leadHours = 10, policyHours = 10, priority = { type: 'fixed', value: 5, bonus: DEFAULT_BONUS } }) {
  const [step, setStep] = useState(1);
  const [cat, setCat] = useState(null);
  const [party, setParty] = useState([]); // [{ svc, guest }]: la primera persona es quien reserva
  const [adding, setAdding] = useState(false); // eligiendo el servicio de otra persona
  const [guest, setGuest] = useState('');
  const [week, setWeek] = useState(0);
  const [days, setDays] = useState(null); // [{date, slots}] de la semana en pantalla
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const jumped = useRef(false); // salta a la semana siguiente solo una vez por reserva

  const partyKey = party.map((x) => x.svc.id).join(',');
  const totalMin = party.reduce((n, x) => n + x.svc.duration_min, 0);
  const totalPrice = party.reduce((n, x) => n + +x.svc.price, 0);
  const svc = party[0]?.svc;

  // Carga la semana: al elegir servicios o al moverse con ‹ ›. Si la primera semana está llena, salta a la siguiente.
  useEffect(() => {
    if (!partyKey) return;
    let live = true;
    setDays(null);
    fetch(`/api/week?start=${addDays(todayStr(), week * 7)}&services=${partyKey}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        const list = j.days || [];
        setDays(list);
        const first = list.find((d) => d.slots.length);
        if (first) setDate((cur) => (cur && list.find((d) => d.date === cur && d.slots.length) ? cur : first.date));
        else if (week === 0 && !jumped.current) { jumped.current = true; setWeek(1); }
      })
      .catch(() => live && setDays([]));
    return () => { live = false; };
  }, [partyKey, week]);

  function pickService(s) {
    if (adding) {
      if (guest.trim().length < 2) { setError('Escribe el nombre de la persona.'); return; }
      setParty([...party, { svc: s, guest: guest.trim() }]);
      setAdding(false); setGuest('');
    } else {
      setParty([{ svc: s, guest: '' }]);
    }
    setError(''); jumped.current = false; setSlot(null); setDate(null); setWeek(0); setStep(2);
  }
  function removeGuest(i) {
    setParty(party.filter((_, k) => k !== i));
    setSlot(null); jumped.current = false;
  }
  const back = () => {
    setError('');
    if (adding) { setAdding(false); setGuest(''); setStep(2); return; }
    setStep((x) => Math.max(1, x - 1));
  };

  async function book() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/book', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: party.map((x) => ({ service_id: x.svc.id, guest_name: x.guest })),
          starts_at: slot.starts_at, name, phone, note,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error); return; }
      setDone(j);
    } catch { setError('No pudimos conectar. Revisa tu internet e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  }

  // Hora de cada persona, una tras otra desde la hora elegida
  const plan = slot ? party.map((x, i) => {
    const before = party.slice(0, i).reduce((n, y) => n + y.svc.duration_min, 0);
    return { ...x, at: hmLocal(+new Date(slot.starts_at) + before * 60000) };
  }) : [];

  if (done) {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/cita/${done.token}`;
    const when = party.length > 1 ? `${cap1(longDay(date))} a las ${slot.time}.` : `${svc.name}, ${longDay(date)} a las ${slot.time}.`;
    const list = party.length > 1 && (
      <ul className="plist">{plan.map((x, i) => <li key={i}><b>{x.guest || 'Tú'}</b> · {x.svc.name} · {x.at}</li>)}</ul>
    );
    return done.status === 'pending' ? (
      <section>
        <h2>{done.open_now === false ? 'Recibimos tu solicitud' : 'El salón está revisando tu solicitud'}</h2>
        <p>{when}</p>
        {list}
        {slot.early && <p className="note">🌅 {PRIORITY_NAME} ({money(slot.fee)}): incluye {priority.bonus.toLowerCase()}.</p>}
        <p>
          {done.open_now === false
            ? `Elena la revisará ${done.opens} y te confirmará por WhatsApp.`
            : 'Te confirmaremos por WhatsApp en cuanto la revisemos.'}
          {' '}Tu cita todavía no está confirmada.
        </p>
        <p>Con este enlace puedes ver el estado de tu solicitud, cambiarla o cancelarla:</p>
        <p><a href={link}>{link}</a></p>
        <p className="note">Guárdalo: se actualiza solo cuando el salón confirme.</p>
      </section>
    ) : (
      <section>
        <h2>Tu cita está confirmada</h2>
        <p>{when}</p>
        {list}
        {slot.early && <p className="note">🌅 {PRIORITY_NAME} ({money(slot.fee)}): incluye {priority.bonus.toLowerCase()}.</p>}
        <p className="note">Puedes cambiarla o cancelarla antes del {deadlineText(slot.starts_at, policyHours)}.</p>
        <p>Guarda este enlace para ver, cambiar o cancelar tu cita:</p>
        <p><a href={link}>{link}</a></p>
      </section>
    );
  }

  const week0Start = addDays(todayStr(), week * 7);
  const dayData = days?.find((d) => d.date === date);
  const noneAtAll = days && week === 1 && !days.some((d) => d.slots.length);
  const selCat = categories.find((c) => c.id === cat);
  const total = totalPrice + (slot?.fee || 0);
  const deadlinePassed = slot && +new Date(slot.starts_at) - policyHours * 3600000 < Date.now();

  return (
    <>
      <div className="steps" aria-label={`Paso ${step} de 4`}>
        {[1, 2, 3, 4].map((n) => <i key={n} className={n <= step ? 'on' : ''} />)}
      </div>
      {(step > 1 || adding) && <button className="back" onClick={back}>‹ Atrás</button>}

      {step === 1 && (
        <section>
          {adding ? (
            <>
              <h2>¿Para quién más?</h2>
              <label>Nombre de la persona
                <input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Ej. Carlos, mi hijo Mateo…" autoFocus />
              </label>
              <h3>¿Qué servicio se hará?</h3>
            </>
          ) : <h2>¿Qué te gustaría hacerte?</h2>}
          <div className="tiles">
            {categories.map((c) => (
              <button key={c.id} className={'tile' + (cat === c.id ? ' on' : '')} onClick={() => setCat(cat === c.id ? null : c.id)}>
                {c.name}<small>{c.services.length} {c.services.length === 1 ? 'servicio' : 'servicios'}</small>
              </button>
            ))}
          </div>
          {selCat && selCat.services.map((s) => (
            <button key={s.id} className="row" onClick={() => pickService(s)}>
              <span>{s.name}</span><span>{dur(s.duration_min)} · ${s.price}</span>
            </button>
          ))}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {step === 2 && svc && (
        <section>
          <h2>Elige día y hora</h2>
          <div className="party">
            {party.map((x, i) => (
              <div className="pline" key={i}>
                <span><b>{x.guest || 'Tú'}</b> · {x.svc.name} · {dur(x.svc.duration_min)}</span>
                {i > 0 && <button className="x" onClick={() => removeGuest(i)} aria-label={`Quitar a ${x.guest}`}>×</button>}
              </div>
            ))}
            {party.length > 1 && <div className="note">Se atienden una tras otra · {dur(totalMin)} en total</div>}
            {party.length < MAX_PEOPLE && (
              <button className="lnk" onClick={() => { setAdding(true); setCat(null); setStep(1); }}>＋ Agregar otra persona</button>
            )}
          </div>
          <div className="weekbar">
            <button className="ghost" disabled={week === 0} onClick={() => setWeek(0)} aria-label="Semana anterior">‹</button>
            <span className="cap">{monthOf(week0Start)}</span>
            <button className="ghost" disabled={week === 1} onClick={() => setWeek(1)} aria-label="Semana siguiente">›</button>
          </div>
          <div className="daystrip">
            {(days || Array.from({ length: 7 }, (_, i) => ({ date: addDays(week0Start, i), slots: null }))).map((d) => (
              <button key={d.date} disabled={!d.slots || !d.slots.length} className={'day' + (d.date === date ? ' on' : '')}
                onClick={() => { setDate(d.date); setSlot(null); }}>
                <small>{dow(d.date)}</small>{dayNum(d.date)}
              </button>
            ))}
          </div>
          {days === null && <p className="note">Buscando horarios…</p>}
          {noneAtAll && <p className="note">No hay horarios en las próximas dos semanas{party.length > 1 ? ' para todas las personas juntas' : ''}. <a className="nb" href={`https://wa.me/${WHATSAPP}`}>Escríbenos por WhatsApp</a>.</p>}
          {dayData && (
            <>
              <h3 className="dayhead">{cap1(longDay(dayData.date))}</h3>
              <div className="grid">
                {dayData.slots.filter((s) => !s.early).map((s) => (
                  <button key={s.starts_at} className={'chip' + (slot?.starts_at === s.starts_at ? ' on' : '')}
                    onClick={() => { setSlot(s); setStep(3); }}>
                    {s.time}
                  </button>
                ))}
              </div>
              {dayData.slots.some((s) => s.early) && (
                <div className="prio">
                  <div className="prio-head">
                    <b>🌅 {PRIORITY_NAME}</b>
                    <span className="prio-tag">{feeTag(priority)}{party.length > 1 ? ' por persona' : ''}</span>
                  </div>
                  <div className="prio-note">Incluye {priority.bonus.toLowerCase()}.</div>
                  <div className="grid">
                    {dayData.slots.filter((s) => s.early).map((s) => (
                      <button key={s.starts_at} className={'chip prio-chip' + (slot?.starts_at === s.starts_at ? ' on' : '')}
                        onClick={() => { setSlot(s); setStep(3); }}>
                        {s.time}<small>+{money(s.fee)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          <p className="note">Las citas se piden con al menos {leadHours} horas de anticipación. ¿Es urgente? <a className="nb" href={`https://wa.me/${WHATSAPP}`}>Escríbenos por WhatsApp</a>.</p>
        </section>
      )}

      {step === 3 && slot && (
        <section>
          <h2>Tus datos</h2>
          <label>Tu nombre<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09XXXXXXXX" autoComplete="tel" /></label>
          <button className="cta" disabled={name.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={() => setStep(4)}>Continuar</button>
        </section>
      )}

      {step === 4 && slot && (
        <section>
          <h2>Confirma tu {review ? 'solicitud' : 'cita'}</h2>
          <div className="card">
            <div className="crow">
              <span className="ico">📅</span>
              <div>
                <b>{cap1(longDay(date))}</b>
                <small>{slot.time} · {dur(totalMin)}</small>
              </div>
            </div>
            {plan.map((x, i) => (
              <div className="crow" key={i}>
                <span className="ico">✂️</span>
                <div>
                  <b>{x.svc.name}</b>
                  <small>{party.length > 1 ? `${x.guest || name.trim()} · ${x.at}` : categories.find((c) => c.services.some((y) => y.id === x.svc.id))?.name}</small>
                </div>
              </div>
            ))}
            <div className="crow">
              <span className="ico">👤</span>
              <div><b>{name.trim()}</b><small>{phone.trim()}</small></div>
            </div>
          </div>

          <div className="pricebox">
            {party.map((x, i) => (
              <div className="prow" key={i}><span>{x.svc.name}{party.length > 1 && <small> · {x.guest || name.trim()}</small>}</span><span>{money(x.svc.price)}</span></div>
            ))}
            {slot.early && (
              <div className="prow prio-row">
                <span>🌅 {PRIORITY_NAME}<small>Incluye {priority.bonus.toLowerCase()}</small></span><span>+{money(slot.fee)}</span>
              </div>
            )}
            <div className="prow total"><span>Total</span><span>{money(total)}</span></div>
          </div>

          <div className="sechead">
            <h3>Nota para el salón</h3>
            <button className="lnk" onClick={() => setNoteOpen(!noteOpen)}>{noteOpen ? 'Listo' : note.trim() ? 'Editar' : 'Agregar'}</button>
          </div>
          {noteOpen
            ? <textarea rows={3} maxLength={300} autoFocus value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. quiero cambiar de color, voy con mi hija…" />
            : note.trim() && <p className="notebox">{note.trim()}</p>}

          <div className="sechead"><h3>Política de cancelación</h3></div>
          {deadlinePassed ? (
            <p className="note">Tu cita es muy pronto: para cambios o cancelaciones, escríbenos por WhatsApp.</p>
          ) : (
            <>
              <span className="deadline">Cancela antes del {deadlineShort(slot.starts_at, policyHours)}</span>
              <p className="note">Puedes cambiar o cancelar tu cita sin costo hasta esa hora, desde el enlace que recibirás. Después, solo por WhatsApp y se registrará como cancelación tardía.</p>
            </>
          )}

          {review && <p className="note">El salón revisará tu solicitud y te confirmará por WhatsApp. Todavía no es una cita confirmada.</p>}
          {error && <p className="error">{error}</p>}
          <button className="cta" disabled={busy} onClick={book}>
            {busy ? 'Enviando…' : review ? 'Enviar solicitud' : 'Confirmar cita'}
          </button>
        </section>
      )}
    </>
  );
}
