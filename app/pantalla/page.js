'use client';
import { useState, useEffect } from 'react';

const TZ = 'America/Guayaquil';
const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const dayKey = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
const dayName = (iso) => new Date(iso).toLocaleDateString('es-EC', { weekday: 'long', timeZone: TZ });
// 433 min → "7 h 13 min"; 45 → "45 min"; 120 → "2 h"
const parts = (mins) => ({ h: Math.floor(mins / 60), m: mins % 60 });
const dur = (mins) => { const { h, m } = parts(mins); return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`; };

function Big({ mins }) {
  const { h, m } = parts(mins);
  return (
    <div className="big">
      {h > 0 && <>{h}<span className="unit">h</span></>}
      {(m > 0 || h === 0) && <>{h > 0 && ' '}{m}<span className="unit">min</span></>}
    </div>
  );
}

export default function Screen() {
  const [d, setD] = useState(null);
  const [off, setOff] = useState(false);
  const [now, setNow] = useState(null); // se llena al montar: evita diferencias entre servidor y navegador

  useEffect(() => {
    const load = () => fetch('/api/screen' + window.location.search)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setD(j); setOff(false); })
      .catch(() => setOff(true));
    setNow(Date.now());
    load();
    const a = setInterval(load, 15000), b = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  if (now === null) return <div className="screen" />;

  const left = (iso) => Math.max(0, Math.ceil((+new Date(iso) - now) / 60000));
  const since = (iso) => Math.max(0, Math.floor((now - +new Date(iso)) / 60000));
  const mins = d?.nextFreeAt ? left(d.nextFreeAt) : null;
  const sameDay = d?.nextFreeAt && dayKey(+new Date(d.nextFreeAt)) === dayKey(now);
  const open = d?.salon?.open !== false;

  let hero;
  if (!d) hero = null;
  else if (!open) {
    const opens = d.salon.opensAt;
    const when = !opens ? null : dayKey(+new Date(opens)) === dayKey(now) ? 'hoy' : dayKey(+new Date(opens)) === dayKey(now + 864e5) ? 'mañana' : dayName(opens);
    hero = (
      <>
        <div className="sc-label">Salón cerrado</div>
        <div className="big small">{when ? `Abrimos ${when}` : 'Cerrado'}</div>
        {opens && <div className="when">{hm(opens)}</div>}
      </>
    );
  } else if (mins === null) {
    hero = (<><div className="sc-label">Próximo turno libre</div><div className="big small">—</div><p className="dim">Hoy no quedan turnos libres</p></>);
  } else if (!sameDay) {
    hero = (
      <>
        <div className="sc-label">Próximo turno libre</div>
        <div className="big small">{dayKey(+new Date(d.nextFreeAt)) === dayKey(now + 864e5) ? 'Mañana' : dayName(d.nextFreeAt)}</div>
        <div className="when">{hm(d.nextFreeAt)}</div>
      </>
    );
  } else {
    hero = (
      <>
        <div className="sc-label">Próximo turno libre</div>
        {mins === 0 ? <div className="big small">Ahora</div> : <Big mins={mins} />}
        <div className="when">{mins === 0 ? 'Hay un espacio libre' : `a las ${hm(d.nextFreeAt)}`}</div>
      </>
    );
  }

  return (
    <div className="screen">
      <header>
        <div>
          <h1>Elle Hair Salon</h1>
          <div className="sub">{(t => t.charAt(0).toUpperCase() + t.slice(1))(new Date(now).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }))}</div>
        </div>
        <div className="clock">{hm(new Date(now).toISOString())}</div>
      </header>
      {off && <p className="dim">Sin conexión, reintentando…</p>}
      {!d ? <p className="dim">Cargando…</p> : (
        <div className="sc-grid">
          <div className="sc-card hero">
            {hero}
            {open && <p className="dim foot">¿Llegaste sin cita? Pregunta en recepción y te registramos.</p>}
          </div>
          <div className="sc-card">
            <div className="sc-label"><i className="dot live" />En atención</div>
            {d.inService.length === 0 && <p className="dim">Nadie por ahora</p>}
            {d.inService.map((x, i) => {
              const total = Math.max(1, (+new Date(x.endsAt) - +new Date(x.startedAt)) / 60000);
              const pct = Math.min(100, Math.max(4, (1 - left(x.endsAt) / total) * 100));
              return (
                <div className="sc-item col" key={i}>
                  <div className="r"><span>{x.name}<small>{x.service} · {x.stylist}</small></span><span className="right">{left(x.endsAt) === 0 ? 'Terminando' : `${dur(left(x.endsAt))}`}</span></div>
                  <div className="bar"><b style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          <div className="sc-card">
            <div className="sc-label"><i className="dot wait" />En espera</div>
            {d.waiting.length === 0 && <p className="dim">Nadie esperando</p>}
            {d.waiting.map((x, i) => (
              <div className="sc-item" key={i}><span>{x.name}<small>{x.service}</small></span><span className="right">{x.since ? `${dur(since(x.since))} esperando` : hm(x.starts_at)}</span></div>
            ))}
          </div>
          <div className="sc-card">
            <div className="sc-label"><i className="dot next" />Siguientes turnos</div>
            {d.next.length === 0 && <p className="dim">No hay más citas por ahora</p>}
            {d.next.map((x, i) => (
              <div className="sc-item" key={i}><span>{x.name}<small>{x.service}</small></span><span className="pill">{hm(x.starts_at)}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
