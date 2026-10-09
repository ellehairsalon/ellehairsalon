'use client';
import { useState, useEffect } from 'react';

export default function ServicesEditor() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState('');
  const [draft, setDraft] = useState({});
  const load = () => fetch('/api/admin/services').then((r) => r.json()).then((j) => setList(j.services || []));
  useEffect(() => { load(); }, []);

  async function save(id, patch) {
    const r = await fetch('/api/admin/services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }),
    });
    setMsg(r.ok ? 'Guardado ✓' : 'No se pudo guardar');
    setTimeout(() => setMsg(''), 2000);
  }
  if (!list) return <p className="note">Cargando…</p>;
  const groups = list.reduce((g, s) => {
    const k = s.category_id;
    (g[k] ||= { name: s.service_categories?.name || 'Otros', items: [] }).items.push(s);
    return g;
  }, {});

  async function add(category_id) {
    const f = draft[category_id] || {};
    const r = await fetch('/api/admin/services', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ create: true, category_id, name: f.name, price: f.price, duration_min: f.min }),
    });
    const j = await r.json();
    setMsg(r.ok ? 'Servicio agregado ✓' : j.error || 'No se pudo guardar');
    if (r.ok) { setDraft({ ...draft, [category_id]: {} }); load(); }
  }
  const setF = (cid, patch) => setDraft({ ...draft, [cid]: { ...(draft[cid] || {}), ...patch } });

  return (
    <div>
      <p className="note">Cambia un valor y toca fuera de la casilla para guardarlo. {msg}</p>
      {Object.entries(groups).map(([cid, { name, items }]) => (
        <details className="fold" key={cid}>
          <summary>{name} ({items.length})</summary>
          {items.map((s) => (
            <div className="svc" key={s.id}>
              <input defaultValue={s.name} style={{ fontWeight: 600 }} onBlur={(e) => e.target.value.trim() !== s.name && save(s.id, { name: e.target.value })} />
              <div className="svc-f">
                <label>Precio $<input type="number" defaultValue={s.price} onBlur={(e) => save(s.id, { price: e.target.value })} /></label>
                <label>Minutos<input type="number" defaultValue={s.duration_min} onBlur={(e) => save(s.id, { duration_min: e.target.value })} /></label>
                <label className="chk"><input type="checkbox" defaultChecked={s.is_active} onChange={(e) => save(s.id, { is_active: e.target.checked })} />Disponible</label>
              </div>
            </div>
          ))}
          <div className="svc">
            <strong>Agregar a {name}</strong>
            <div className="svc-f">
              <label>Nombre<input value={draft[cid]?.name || ''} onChange={(e) => setF(cid, { name: e.target.value })} /></label>
              <label>Precio $<input type="number" value={draft[cid]?.price || ''} onChange={(e) => setF(cid, { price: e.target.value })} /></label>
              <label>Minutos<input type="number" value={draft[cid]?.min || ''} onChange={(e) => setF(cid, { min: e.target.value })} /></label>
            </div>
            <button className="ghost" style={{ marginTop: 8 }} onClick={() => add(cid)}>Agregar servicio</button>
          </div>
        </details>
      ))}
    </div>
  );
}
