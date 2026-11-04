'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { svcEmoji } from '@/lib/emoji';
import { waLink, confirmText } from '@/lib/wa';

const TZ = 'America/Guayaquil';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const today = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const plus = (d, n) => new Date(+new Date(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const iso = (date, time) => `${date}T${time}:00-05:00`;
const toMin = (t) => { const [h, m] = t.split(':'); return +h * 60 + +m; };
const dayName = (d) => cap(new Date(d + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }));
const weeksAgo = (iso) => { const w = Math.round((Date.now() - +new Date(iso)) / (7 * 864e5)); return w < 1 ? 'esta semana' : w === 1 ? 'hace 1 semana' : `hace ${w} semanas`; };

// Cualquier parte del panel puede abrir el agendador:  window.dispatchEvent(new CustomEvent('elle:new', { detail: { date, min, client, services } }))
export default function NewAppt({ policyHours = 10, bonus }) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('book'); // book | now (llegó sin cita)
  const [svcs, setSvcs] = useState([]);
  const [cat, setCat] = useState('all');
  const [picked, setPicked] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [clientId, setClientId] = useState(null);
  const [found, setFound] = useState([]);
  const [known, setKnown] = useState(null);
  const [last, setLast] = useState(null);
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState(null);
  const [slot, setSlot] = useState(null); // starts_at elegido de la lista
  const [custom, setCustom] = useState(''); // "HH:MM" escrita a mano
  const [conflicts, setConflicts] = useState([]);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState(null);
  const want = useRef(null); // hora pedida desde el calendario, se aplica cuando cargan los horarios
  const nameRef = useRef(null);
  const showFab = path === '/admin';

  const cats = useMemo(() => {
    const g = [];
    for (const s of svcs) {
      const n = s.service_categories?.name || 'Otros';
      (g.find((x) => x.name === n) || (g[g.length] = { name: n, items: [] })).items.push(s);
    }
    return g;
  }, [svcs]);
  const shown = cat === 'all' ? cats.flatMap((c) => c.items.map((s) => ({ s, cn: c.name }))) : (cats.find((c) => c.name === cat)?.items || []).map((s) => ({ s, cn: cat }));
  const chosen = picked.map((id) => svcs.find((s) => s.id === id)).filter(Boolean);
  const total = chosen.reduce((n, s) => n + s.duration_min, 0);
  const digits = phone.replace(/\D/g, '');
  const start = mode === 'now' ? null : slot || (custom && date ? iso(date, custom) : null);
  const forced = !!start && slots && !slots.some((x) => +new Date(x.starts_at) === +new Date(start));
  const ready = name.trim().length >= 2 && digits.length >= 9 && chosen.length > 0 && (mode === 'now' || !!start);

  function reset() {
    setMade(null); setErr(''); setPicked([]); setName(''); setPhone(''); setClientId(null); setFound([]); setKnown(null); setLast(null);
    setSlot(null); setCustom(''); setConflicts([]); setNotes(''); setCat('all'); setMode('book'); setDate(today()); want.current = null;
  }
  function close() { setOpen(false); reset(); }

  // Abrir desde cualquier lado (calendario, ficha, seguimiento) o con la tecla N
  useEffect(() => {
    const on = (e) => {
      const d = e.detail || {};
      reset(); setOpen(true);
      if (d.date) setDate(d.date);
      if (d.min != null) want.current = `${String(Math.floor(d.min / 60)).padStart(2, '0')}:${String(d.min % 60).padStart(2, '0')}`;
      if (d.client) { setName(d.client.full_name); setPhone(d.client.phone); setClientId(d.client.id); setKnown(d.client); }
      if (d.services?.length) setPicked(d.services);
      if (d.now) setMode('now');
    };
    const key = (e) => {
      const t = e.target; const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === 'Escape') { if (open && !made) close(); else if (open) close(); return; }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'n' || e.key === 'N') && !open) { e.preventDefault(); window.dispatchEvent(new CustomEvent('elle:new', { detail: { date: today() } })); }
    };
    window.addEventListener('elle:new', on); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('elle:new', on); window.removeEventListener('keydown', key); };
  }, [open, made]);

  useEffect(() => {
    document.body.classList.toggle('nd-open', open);
    if (open) setTimeout(() => nameRef.current?.focus(), 80);
    return () => document.body.classList.remove('nd-open');
  }, [open]);

  useEffect(() => {
    if (open && !svcs.length) fetch('/api/admin/services').then((r) => r.json()).then((j) => setSvcs((j.services || []).filter((s) => s.is_active)));
  }, [open]);

  // Horarios libres del día para los servicios elegidos
  useEffect(() => {
    if (!open || mode === 'now' || !picked.length || !date) { setSlots(null); return; }
    let alive = true; setSlots(null);
    fetch(`/api/admin/slots?services=${picked.join(',')}&date=${date}`).then((r) => r.json()).then((j) => {
      if (!alive) return;
      const list = j.slots || [];
      setSlots(list);
      if (want.current) { // la hora que Elena tocó en el calendario
        const w = want.current; want.current = null;
        const hit = list.find((x) => x.time === w);
        if (hit) { setSlot(hit.starts_at); setCustom(''); } else { setSlot(null); setCustom(w); }
      } else setSlot((cur) => (cur && list.some((x) => x.starts_at === cur) ? cur : null));
    }).catch(() => alive && setSlots([]));
    return () => { alive = false; };
  }, [open, picked.join(','), date, mode]);

  // Avisar si la hora forzada choca con otra cita
  useEffect(() => {
    setConflicts([]);
    if (!forced || !picked.length) return;
    let alive = true;
    const t = setTimeout(() => fetch(`/api/admin/slots?services=${picked.join(',')}&date=${date}&check=${encodeURIComponent(new Date(start).toISOString())}`)
      .then((r) => r.json()).then((j) => alive && setConflicts(j.conflicts || [])).catch(() => {}), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [forced, start, picked.join(',')]);

  // Buscar cliente por nombre o teléfono mientras se escribe
  useEffect(() => {
    if (!open || clientId || name.trim().length < 2) { setFound([]); return; }
    let alive = true;
    const t = setTimeout(() => fetch(`/api/admin/client?q=${encodeURIComponent(name.trim())}`).then((r) => r.json()).then((j) => alive && setFound(j.clients || [])).catch(() => {}), 200);
    return () => { alive = false; clearTimeout(t); };
  }, [name, clientId, open]);

  // WhatsApp completo → ¿ya existe?
  useEffect(() => {
    if (!open || clientId || digits.length < 9) return;
    let alive = true;
    const t = setTimeout(() => fetch(`/api/admin/client?phone=${encodeURIComponent(phone)}`).then((r) => r.json()).then((j) => {
      if (!alive || !j.client) return;
      setKnown(j.client); setClientId(j.client.id); setName(j.client.full_name);
    }).catch(() => {}), 250);
    return () => { alive = false; clearTimeout(t); };
  }, [phone, open]);

  // Sugerir "repetir lo de la última vez"
  useEffect(() => {
    setLast(null);
    if (!clientId) return;
    let alive = true;
    fetch(`/api/admin/client?last=${clientId}`).then((r) => r.json()).then((j) => alive && setLast(j.last || null)).catch(() => {});
    return () => { alive = false; };
  }, [clientId]);

  // Vista previa en la agenda (el bloque aparece mientras se llena)
  useEffect(() => {
    const detail = open && mode === 'book' && start && total ? { date, s: toMin(new Date(+new Date(start) - 5 * 3600000).toISOString().slice(11, 16)), e: 0, label: name.trim() || 'Nueva cita' } : null;
    if (detail) detail.e = detail.s + total;
    window.dispatchEvent(new CustomEvent('elle:preview', { detail }));
  }, [open, mode, start, total, date, name]);

  function pickClient(c) { setName(c.full_name); setPhone(c.phone); setClientId(c.id); setKnown(c); setFound([]); }
  function unpick() { setClientId(null); setKnown(null); setLast(null); setName(''); setPhone(''); setTimeout(() => nameRef.current?.focus(), 30); }
  function toggle(id) { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 6 ? p : [...p, id])); }

  async function save(sendWa) {
    if (!ready || busy) return;
    const w = sendWa ? window.open('', '_blank') : null; // se abre ya, para que el navegador no lo bloquee
    setBusy(true); setErr('');
    let r, j;
    try {
      r = await fetch('/api/admin/new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'now'
        ? { items: picked, name, phone, start_now: true, notes } : { items: picked, name, phone, starts_at: new Date(start).toISOString(), force: forced, notes }) });
      j = await r.json();
    } catch { r = { ok: false }; j = { error: 'Sin conexión. Inténtalo otra vez.' }; }
    setBusy(false);
    if (!r.ok) { w?.close(); setErr(j.error || 'No se pudo guardar.'); return; }
    router.refresh();
    const a = j.appt;
    const link = a && mode !== 'now' ? waLink(a.phone, confirmText({ clients: { full_name: a.client_name }, services: { name: a.service }, starts_at: a.starts_at, early_fee: a.early_fee, early: a.early, manage_token: a.manage_token },
      window.location.origin, policyHours, a.items.length > 1 ? a.items.map((x) => ({ clients: { full_name: a.client_name }, services: { name: x.service }, starts_at: x.starts_at })) : undefined, bonus)) : null;
    if (w && link) w.location.href = link; else w?.close();
    setMade({ a, link, now: mode === 'now', sent: !!(w && link) });
    window.dispatchEvent(new CustomEvent('elle:preview', { detail: null }));
  }

  const groups = useMemo(() => {
    if (!slots) return [];
    const g = [{ k: 'e', label: '🌅 Turno prioritario', items: slots.filter((x) => x.early) }, { k: 'a', label: 'Mañana', items: [] }, { k: 'p', label: 'Tarde', items: [] }, { k: 'n', label: 'Noche', items: [] }];
    for (const x of slots.filter((y) => !y.early)) g[+x.time.slice(0, 2) < 12 ? 1 : +x.time.slice(0, 2) < 18 ? 2 : 3].items.push(x);
    return g.filter((x) => x.items.length);
  }, [slots]);

  const onEnter = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && ready) { e.preventDefault(); save(false); } };
  const lastSvc = last && svcs.find((s) => s.id === last.service_id);

  return (
    <>
      {showFab && !open && <button className="fab" aria-label="Nueva cita" onClick={() => window.dispatchEvent(new CustomEvent('elle:new', { detail: { date: today() } }))}><span>＋</span><b>Nueva cita</b></button>}
      {open && <div className="nd-scrim" onClick={close} />}
      {open && (
        <aside className="nd" role="dialog" aria-label="Nueva cita" onKeyDown={onEnter}>
          <header className="nd-head">
            <div><b>{made ? (made.now ? 'Ya está en atención' : 'Cita agendada') : mode === 'now' ? 'Llegó sin cita' : 'Nueva cita'}</b>
              {!made && <small className="kb">{mode === 'now' ? 'Empieza ahora mismo' : 'Pulsa Esc para cerrar'}</small>}</div>
            <button className="nd-x" onClick={close} aria-label="Cerrar">✕</button>
          </header>

          {made ? (
            <div className="nd-body nd-done">
              <div className="na-check">✓</div>
              <b>{name.trim()}</b>
              <span>{made.a?.service}{!made.now && made.a && <><br />{cap(new Date(made.a.starts_at).toLocaleString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }))}</>}</span>
              {made.sent && <p className="note">Se abrió WhatsApp con la confirmación en otra pestaña.</p>}
              {made.link && !made.sent && <a className="btn wa full" target="_blank" rel="noopener noreferrer" href={made.link}>💬 Enviar confirmación por WhatsApp</a>}
              <button className="btn soft full" onClick={close}>Listo</button>
              <button className="btn tint full" onClick={() => window.dispatchEvent(new CustomEvent('elle:new', { detail: { date } }))}>Agendar otra cita</button>
            </div>
          ) : (<>
            <div className="nd-body">
              <div className="nd-modes" role="tablist">
                <button className={mode === 'book' ? 'on' : ''} onClick={() => setMode('book')}>📅 Agendar</button>
                <button className={mode === 'now' ? 'on' : ''} onClick={() => setMode('now')}>⚡ Llegó sin cita</button>
              </div>

              <section className="nd-sec">
                <h3>1 · Cliente</h3>
                {clientId ? (
                  <div className="nd-client"><span className="avatar">{name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}</span>
                    <span className="li-main"><b>{name}</b><small>{phone}</small></span><button className="btn soft sm" onClick={unpick}>Cambiar</button></div>
                ) : (<>
                  <div className="nd-search">
                    <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Busca por nombre o teléfono, o escribe un cliente nuevo" autoComplete="off" />
                    {found.length > 0 && <div className="nd-found">{found.map((c) => <button key={c.id} onClick={() => pickClient(c)}><b>{c.full_name}</b><small>{c.phone}</small></button>)}</div>}
                  </div>
                  <input className="nd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="WhatsApp (09XXXXXXXX)" autoComplete="off" />
                  {name.trim().length >= 2 && digits.length >= 9 && !known && <p className="note">Cliente nuevo: se guardará con estos datos.</p>}
                </>)}
                {lastSvc && !picked.includes(lastSvc.id) && (
                  <button className="nd-repeat" onClick={() => toggle(lastSvc.id)}>🔁 Repetir: <b>{lastSvc.name}</b> · {weeksAgo(last.starts_at)}</button>
                )}
              </section>

              <section className="nd-sec">
                <h3>2 · Servicios <small>{chosen.length ? `${chosen.length} · ${dur(total)}` : 'elige uno o varios'}</small></h3>
                <div className="pills na-pills" role="tablist" aria-label="Categorías">
                  {[{ name: 'all', label: 'Todos' }, ...cats.map((c) => ({ name: c.name, label: c.name }))].map((c) => (
                    <button key={c.name} role="tab" aria-selected={cat === c.name} className={'pill' + (cat === c.name ? ' on' : '')} onClick={() => setCat(c.name)}>{c.label}</button>
                  ))}
                </div>
                {!svcs.length && <p className="note">Cargando…</p>}
                <div className="nd-svcs">
                  {shown.map(({ s, cn }) => (
                    <button key={s.id} className={'nd-svc' + (picked.includes(s.id) ? ' on' : '')} onClick={() => toggle(s.id)} aria-pressed={picked.includes(s.id)}>
                      <span aria-hidden="true">{svcEmoji(s.name, cn)}</span><b>{s.name}</b><small>{dur(s.duration_min)}</small>{picked.includes(s.id) && <i>✓</i>}
                    </button>
                  ))}
                </div>
              </section>

              {mode === 'book' && (
                <section className="nd-sec">
                  <h3>3 · Día y hora</h3>
                  <div className="nd-days">
                    <button className={date === today() ? 'on' : ''} onClick={() => setDate(today())}>Hoy</button>
                    <button className={date === plus(today(), 1) ? 'on' : ''} onClick={() => setDate(plus(today(), 1))}>Mañana</button>
                    <input type="date" value={date} min={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Elegir otro día" />
                  </div>
                  <p className="nd-dayname">{dayName(date)}</p>
                  {!picked.length && <p className="note">Elige un servicio para ver los horarios libres.</p>}
                  {picked.length > 0 && slots === null && <p className="note">Buscando horarios…</p>}
                  {slots && groups.length === 0 && <p className="note">No hay horarios libres este día. Puedes escribir otra hora abajo.</p>}
                  {groups.map((g) => (
                    <div key={g.k} className="nd-grp"><span>{g.label}</span>
                      <div>{g.items.map((x) => <button key={x.starts_at} className={'nd-slot' + (slot === x.starts_at ? ' on' : '') + (x.early ? ' early' : '')} onClick={() => { setSlot(x.starts_at); setCustom(''); }}>{x.time}</button>)}</div>
                    </div>
                  ))}
                  <label className="nd-custom">Otra hora <input type="time" step="900" value={custom} onChange={(e) => { setCustom(e.target.value); setSlot(null); }} /></label>
                  {forced && (
                    <div className="nd-warn">
                      <b>Esta hora no está entre los horarios libres.</b> Se agendará igual si lo confirmas.
                      {conflicts.map((c, i) => <div key={i}>⚠ Choca con {c.name} ({hm(c.starts_at)}–{hm(c.ends_at)})</div>)}
                    </div>
                  )}
                </section>
              )}

              <section className="nd-sec">
                <h3>{mode === 'book' ? '4' : '3'} · Nota <small>opcional</small></h3>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej. viene con foto de referencia" />
              </section>
              {err && <p className="error">{err}</p>}
            </div>

            <footer className="nd-foot">
              {mode === 'now'
                ? <button className="btn primary full" disabled={!ready || busy} onClick={() => save(false)}>{busy ? 'Guardando…' : 'Empezar ahora'}</button>
                : (<>
                  <button className="btn primary" disabled={!ready || busy} onClick={() => save(false)}>{busy ? 'Guardando…' : forced ? 'Agendar igual' : 'Agendar'}</button>
                  <button className="btn wa" disabled={!ready || busy} onClick={() => save(true)}>Agendar + WhatsApp</button>
                </>)}
              <small>{ready ? (mode === 'book' && start ? `${cap(new Date(start).toLocaleString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }))} · ${dur(total)}` : dur(total)) : 'Completa cliente, servicio y hora'}<span className="kb"> · Enter para guardar</span></small>
            </footer>
          </>)}
        </aside>
      )}
    </>
  );
}
