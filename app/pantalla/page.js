'use client';
import { useState, useEffect } from 'react';

const hm = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });

export default function Screen() {
  const [d, setD] = useState(null);
  const [off, setOff] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () => fetch('/api/screen' + window.location.search)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => { setD(j); setOff(false); })
      .catch(() => setOff(true));
    load();
    const a = setInterval(load, 15000), b = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const left = (iso) => Math.max(0, Math.ceil((+new Date(iso) - now) / 60000));
  const mins = d?.nextFreeAt ? left(d.nextFreeAt) : null;

  return (
    <div className="screen">
      <header>
        <h1>Elle Hair Salon</h1>
        <div className="clock">{hm(new Date(now).toISOString())}</div>
      </header>
      {off && <p className="dim">Sin conexión, reintentando…</p>}
      {!d ? <p className="dim">Cargando…</p> : (
        <div className="sc-grid">
          <div className="sc-card hero">
            <div className="sc-label">Próximo turno libre</div>
            <div className="big">{mins === null ? '—' : mins === 0 ? 'Ahora' : `${mins} min`}</div>
            {d.nextFreeAt && <div className="clock">{hm(d.nextFreeAt)}</div>}
            <p className="dim">¿Llegaste sin cita? Pregunta en recepción y te registramos.</p>
          </div>
          <div className="sc-card">
            <div className="sc-label">En atención</div>
            {d.inService.length === 0 && <p className="dim">Nadie por ahora</p>}
            {d.inService.map((x, i) => (
              <div className="sc-item" key={i}><span>{x.name}<small>{x.service} · {x.stylist}</small></span><span>{left(x.endsAt)} min</span></div>
            ))}
          </div>
          <div className="sc-card">
            <div className="sc-label">En espera</div>
            {d.waiting.length === 0 && <p className="dim">Nadie esperando</p>}
            {d.waiting.map((x, i) => (
              <div className="sc-item" key={i}><span>{x.name}<small>{x.service}</small></span><span>{hm(x.starts_at)}</span></div>
            ))}
          </div>
          <div className="sc-card">
            <div className="sc-label">Siguientes turnos</div>
            {d.next.length === 0 && <p className="dim">No hay más citas por ahora</p>}
            {d.next.map((x, i) => (
              <div className="sc-item" key={i}><span>{x.name}<small>{x.service}</small></span><span>{hm(x.starts_at)}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
