'use client';
import { useState, useEffect } from 'react';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const t5 = (t) => (t || '').slice(0, 5);

export default function ScheduleEditor() {
  const [cfg, setCfg] = useState(null);
  const [hours, setHours] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/admin/settings').then((r) => r.json()).then((j) => { setCfg(j.cfg); setHours(j.hours || []); }); }, []);

  async function post(body) {
    const r = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setMsg(r.ok ? 'Guardado ✓' : 'No se pudo guardar');
    setTimeout(() => setMsg(''), 2000);
  }
  if (!cfg) return null;

  const setFee = (patch) => {
    const n = { ...cfg, ...patch };
    setCfg(n);
    post({ kind: 'fee', early_fee_type: n.early_fee_type, early_fee_value: n.early_fee_value, early_bonus: n.early_bonus });
  };
  const setDay = (wd, patch) => {
    const n = hours.map((h) => (h.weekday === wd ? { ...h, ...patch } : h));
    setHours(n);
    const h = n.find((x) => x.weekday === wd);
    post({ kind: 'hours', weekday: wd, is_open: h.is_open, open_time: t5(h.open_time), close_time: t5(h.close_time), early_open_time: t5(h.early_open_time) });
  };

  return (
    <section>
      <p className="note">Los cambios se guardan solos. {msg}</p>
      {hours.map((h) => (
        <div className="svc" key={h.weekday}>
          <label className="chk"><input type="checkbox" checked={h.is_open} onChange={(e) => setDay(h.weekday, { is_open: e.target.checked })} /><strong>{DIAS[h.weekday]}</strong></label>
          {h.is_open && (
            <div className="svc-f">
              <label>Abre<input type="time" value={t5(h.open_time)} onChange={(e) => setDay(h.weekday, { open_time: e.target.value })} /></label>
              <label>Cierra<input type="time" value={t5(h.close_time)} onChange={(e) => setDay(h.weekday, { close_time: e.target.value })} /></label>
              <label>Turnos tempranos desde<input type="time" value={t5(h.early_open_time)} onChange={(e) => setDay(h.weekday, { early_open_time: e.target.value })} /></label>
            </div>
          )}
        </div>
      ))}
      <h3>Turno prioritario (horario temprano)</h3>
      <p className="note">Los horarios antes de la apertura se muestran como "Turno prioritario", con el precio extra y lo que incluye.</p>
      <div className="svc-f">
        <label>Tipo
          <select value={cfg.early_fee_type} onChange={(e) => setFee({ early_fee_type: e.target.value })}>
            <option value="fixed">Monto fijo ($)</option><option value="percent">Porcentaje (%)</option>
          </select>
        </label>
        <label>Valor<input type="number" defaultValue={cfg.early_fee_value} onBlur={(e) => setFee({ early_fee_value: e.target.value })} /></label>
      </div>
      <label>Lo que incluye el turno prioritario
        <input defaultValue={cfg.early_bonus || 'Lavado con masaje de cuero cabelludo'} maxLength={80}
          onBlur={(e) => setFee({ early_bonus: e.target.value })} />
      </label>
    </section>
  );
}
