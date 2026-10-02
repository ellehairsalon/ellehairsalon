'use client';
import { useState, useEffect } from 'react';

export default function ServicesEditor() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/admin/services').then((r) => r.json()).then((j) => setList(j.services || [])); }, []);

  async function save(id, patch) {
    const r = await fetch('/api/admin/services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    });
    setMsg(r.ok ? 'Guardado ✓' : 'No se pudo guardar');
    setTimeout(() => setMsg(''), 2000);
  }
  if (!list) return <p className="note">Cargando…</p>;
  const groups = list.reduce((g, s) => { (g[s.service_categories?.name || 'Otros'] ||= []).push(s); return g; }, {});

  return (
    <section>
      <h2>Servicios y precios</h2>
      <p className="note">Cambia un valor y toca fuera de la casilla para guardarlo. {msg}</p>
      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat}>
          <h3>{cat}</h3>
          {items.map((s) => (
            <div className="svc" key={s.id}>
              <strong>{s.name}</strong>
              <div className="svc-f">
                <label>Precio $<input type="number" defaultValue={s.price} onBlur={(e) => save(s.id, { price: e.target.value })} /></label>
                <label>Minutos<input type="number" defaultValue={s.duration_min} onBlur={(e) => save(s.id, { duration_min: e.target.value })} /></label>
                <label className="chk"><input type="checkbox" defaultChecked={s.is_active} onChange={(e) => save(s.id, { is_active: e.target.checked })} />Disponible</label>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
