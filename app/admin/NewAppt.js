'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { svcEmoji } from '@/lib/emoji';
import { waLink, confirmText } from '@/lib/wa';

const TZ = 'America/Guayaquil';
const fmt = (iso) => new Date(iso).toLocaleString('es-EC', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const inMin = (m) => (m < 1 ? 'ahora' : m < 60 ? `en ${m} min` : `en ${dur(m)}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// próximos 14 días (fecha de Ecuador)
const days = () => Array.from({ length: 14 }, (_, i) => {
  const d = new Date(Date.now() - 5 * 3600000 + i * 864e5);
  const iso = d.toISOString().slice(0, 10);
  const wd = new Date(iso + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return { iso, wd: i === 0 ? 'Hoy' : cap(wd), n: +iso.slice(8) };
});

export default function NewAppt({ policyHours = 10, bonus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [svcs, setSvcs] = useState([]);
  const [cat, setCat] = useState('all');
  const [svc, setSvc] = useState(null);
  const [asap, setAsap] = useState(undefined); // undefined = cargando, null = sin huecos
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState([]);
  const [known, setKnown] = useState(null); // null = sin buscar, false = cliente nuevo, objeto = ya existe
  const [okMsg, setOkMsg] = useState('');
  const [made, setMade] = useState(null); // cita recién creada: permite enviar la confirmación por WhatsApp
  const strip = useMemo(days, [open]);

  const cats = useMemo(() => {
    const g = [];
    for (const s of svcs) {
      const n = s.service_categories?.name || 'Otros';
      (g.find((x) => x.name === n) || (g[g.length] = { name: n, items: [] })).items.push(s);
    }
    return g;
  }, [svcs]);
  const shownSvcs = cat === 'all' ? cats.flatMap((c) => c.items.map((s) => ({ s, cn: c.name }))) : (cats.find((c) => c.name === cat)?.items || []).map((s) => ({ s, cn: cat }));

  useEffect(() => {
    if (open && !svcs.length)
      fetch('/api/admin/services').then((r) => r.json()).then((j) => setSvcs((j.services || []).filter((s) => s.is_active)));
  }, [open]);

  useEffect(() => {
    setAsap(undefined); setSlot(null); setSlots(null); setDate('');
    if (!svc) return;
    fetch(`/api/admin/slots?service=${svc.id}&asap=1`).then((r) => r.json()).then((j) => setAsap(j.slot || null));
  }, [svc]);

  useEffect(() => {
    if (!svc || !date) return;
    setSlots(null);
    fetch(`/api/admin/slots?service=${svc.id}&date=${date}`).then((r) => r.json()).then((j) => setSlots(j.slots || []));
  }, [date]);

  // Al escribir el WhatsApp completo: si el cliente ya existe, se llena su nombre
  const digits = phone.replace(/\D/g, '');
  useEffect(() => {
    setKnown(null);
    if (step !== 3 || digits.length < 9) return;
    let alive = true;
    const t = setTimeout(() => fetch(`/api/admin/client?phone=${encodeURIComponent(phone)}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      setKnown(j.client || false);
      if (j.client) setName(j.client.full_name);
    }).catch(() => {}), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [phone, step]);

  // sin teléfono todavía: buscar por nombre
  useEffect(() => {
    if (step !== 3 || digits.length >= 4 || name.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => fetch(`/api/admin/client?q=${encodeURIComponent(name.trim())}`).then((r) => r.json()).then((j) => setFound(j.clients || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [name, phone, step]);

  function close() { setMade(null); setKnown(null); setFound([]); setOkMsg(''); setOpen(false); setStep(1); setSvc(null); setSlot(null); setDate(''); setName(''); setPhone(''); setErr(''); }
  function choose(s) { setSlot(s); setStep(3); }

  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/admin/new', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot.now
        ? { service_id: svc.id, name, phone, start_now: true }
        : { service_id: svc.id, starts_at: slot.starts_at, name, phone, walk_in: !!slot.walk }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    router.refresh();
    if (slot.now || !j.appt) { setOkMsg(slot.now ? 'Ya está en atención' : 'Cita agendada'); setTimeout(close, 1700); return; }
    setMade(j.appt);
    setOkMsg(`Agendada · ${cap(fmt(slot.starts_at))}`);
  }

  const groups = useMemo(() => {
    if (!slots) return [];
    const g = [
      { k: 'early', label: '🌅 Turno prioritario', items: slots.filter((x) => x.early) },
      { k: 'am', label: 'Mañana', items: [] }, { k: 'pm', label: 'Tarde', items: [] }, { k: 'nt', label: 'Noche', items: [] },
    ];
    for (const x of slots.filter((y) => !y.early)) {
      const h = +x.time.slice(0, 2);
      g[h < 12 ? 1 : h < 18 ? 2 : 3].items.push(x);
    }
    return g.filter((x) => x.items.length);
  }, [slots]);
  const dayLabel = date ? cap(new Date(date + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })) : '';
  const emo = svc ? svcEmoji(svc.name, svc.service_categories?.name) : '';
  const when = slot ? (slot.now ? 'Ahora mismo · pasa a “En atención”' : cap(fmt(slot.starts_at))) : '';

  return (
    <>
      <button className="fab" aria-label="Nueva cita" onClick={() => setOpen(true)}><span>＋</span><b>Nueva cita</b></button>
      {open && (
        <div className="scrim center" onClick={close}>
          <div className="sheet na" onClick={(e) => e.stopPropagation()}>
            {okMsg ? (
              <div className="na-ok">
                <div className="na-check">✓</div>
                <b>{okMsg}</b>
                <small>{name.trim()} · {svc?.name}</small>
                {made && (
                  <div className="na-ok-actions">
                    <a target="_blank" rel="noopener noreferrer" className="btn wa full" onClick={() => setTimeout(close, 400)}
                      href={waLink(made.phone, confirmText({ clients: { full_name: made.client_name }, services: { name: made.service }, starts_at: made.starts_at, early_fee: made.early_fee, early: made.early, manage_token: made.manage_token }, window.location.origin, policyHours, null, bonus))}>
                      💬 Enviar confirmación por WhatsApp
                    </a>
                    <button className="btn soft full" onClick={close}>Listo, sin enviar</button>
                  </div>
                )}
              </div>
            ) : (<>
            <div className="na-bar">
              {step > 1 ? <button className="na-ic" onClick={() => setStep(step - 1)} aria-label="Atrás">‹</button> : <span className="na-ic ghosted" />}
              <div className="na-title">
                <b>{step === 1 ? 'Nueva cita' : step === 2 ? '¿Cuándo?' : '¿Para quién?'}</b>
                <span className="na-step">{step === 1 ? 'Elige el servicio' : step === 2 ? 'Elige día y hora' : 'Datos del cliente'}</span>
                <div className="na-dots">{[1, 2, 3].map((n) => <i key={n} className={n <= step ? 'on' : ''} />)}</div>
              </div>
              <button className="na-ic" onClick={close} aria-label="Cerrar">✕</button>
            </div>

            {step === 2 && svc && (
              <button className="na-chip" onClick={() => setStep(1)}>
                <span>{emo}</span><b>{svc.name}</b><small>{dur(svc.duration_min)}</small><em>Cambiar</em>
              </button>
            )}

            {step === 1 && (
              <>
                <div className="pills na-pills" role="tablist" aria-label="Categorías">
                  {[{ name: 'all', label: 'Todos' }, ...cats.map((c) => ({ name: c.name, label: c.name }))].map((c) => (
                    <button key={c.name} role="tab" aria-selected={cat === c.name} className={'pill' + (cat === c.name ? ' on' : '')} onClick={() => setCat(c.name)}>{c.label}</button>
                  ))}
                </div>
                {!svcs.length && <p className="note">Cargando…</p>}
                <div className="na-svcs">
                  {shownSvcs.map(({ s, cn }) => (
                    <button key={s.id} className="na-svcrow" onClick={() => { setSvc(s); setStep(2); }}>
                      <span className="svc-emo" aria-hidden="true">{svcEmoji(s.name, cn)}</span>
                      <span className="svc-main"><b>{s.name}</b><small>{dur(s.duration_min)}</small></span>
                      <i aria-hidden="true">›</i>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <button className="na-card na-now" onClick={() => choose({ now: true })}>
                  <span className="na-ci">⚡</span>
                  <span><b>Llegó sin cita</b><small>Empezar ahora mismo</small></span>
                  <i>›</i>
                </button>
                <button className="na-card" disabled={!asap} onClick={() => asap && choose({ ...asap, walk: true })}>
                  <span className="na-ci">🕒</span>
                  <span>
                    <b>Primer hueco libre</b>
                    <small>{asap === undefined ? 'Buscando…' : asap ? `${cap(fmt(asap.starts_at))} · ${inMin(asap.minutes)}` : 'No hay huecos en 2 semanas'}</small>
                  </span>
                  <i>›</i>
                </button>

                <div className="na-label">O elige otro día</div>
                <div className="na-days">
                  {strip.map((d) => (
                    <button key={d.iso} className={'na-day' + (date === d.iso ? ' on' : '')} onClick={() => setDate(d.iso)}>
                      <small>{d.wd}</small><b>{d.n}</b>
                    </button>
                  ))}
                </div>
                {date && <div className="na-daylabel">{dayLabel}</div>}
                {date && slots === null && <p className="note">Buscando horarios…</p>}
                {date && slots && slots.length === 0 && <p className="note">No hay horarios libres ese día.</p>}
                {groups.map((g) => (
                  <div key={g.k} className="na-grp">
                    <div className="na-grp-l">{g.label}</div>
                    <div className="na-times">
                      {g.items.map((s) => (
                        <button key={s.starts_at} className={'na-time' + (s.early ? ' early' : '')} onClick={() => choose(s)}>{s.time}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 3 && slot && (
              <>
                <div className="na-sum">
                  <span className="na-emo">{emo}</span>
                  <div><b>{svc.name}</b><small>{when}</small></div>
                  <button className="na-edit" onClick={() => setStep(2)}>Cambiar</button>
                </div>
                <label>WhatsApp
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="09XXXXXXXX" autoFocus autoComplete="off" />
                </label>
                {known && <span className="na-found-ok">✓ Cliente guardado</span>}
                {known === false && <span className="na-new">Cliente nuevo: escribe su nombre</span>}
                <label>Nombre
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del cliente" autoComplete="off" />
                </label>
                {known && name.trim() && name.trim() !== known.full_name && <p className="note">Se corregirá el nombre guardado: “{known.full_name}” → “{name.trim()}”.</p>}
                {found.length > 0 && (
                  <div className="na-found">
                    <div className="na-grp-l">¿Es alguno de estos clientes?</div>
                    {found.map((c) => (
                      <button key={c.id} className="na-who" onClick={() => { setName(c.full_name); setPhone(c.phone); setFound([]); }}>
                        <span className="na-av">{c.full_name.trim().charAt(0).toUpperCase()}</span>
                        <span><b>{c.full_name}</b><small>{c.phone}</small></span>
                        <i>Usar</i>
                      </button>
                    ))}
                  </div>
                )}
                {err && <p className="error">{err}</p>}
                <div className="na-foot">
                  <button className="cta na-go" disabled={busy || name.trim().length < 2 || phone.replace(/\D/g, '').length < 9} onClick={save}>
                    {busy ? 'Guardando…' : slot.now ? '⚡ Empezar ahora' : '✓ Agendar cita'}
                  </button>
                </div>
              </>
            )}
            </>)}
          </div>
        </div>
      )}
    </>
  );
}
