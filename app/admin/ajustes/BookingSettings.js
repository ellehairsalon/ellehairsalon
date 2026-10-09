'use client';
import { useState, useEffect } from 'react';

const MODES = [
  { id: 'manual', title: 'Yo confirmo cada solicitud', hint: 'Todas llegan a "Solicitudes" y tú las confirmas por WhatsApp.' },
  { id: 'mixed', title: 'Mixto', hint: 'Se confirman solas; solo revisas las de horario temprano, servicios de 3 h o más y clientas nuevas.' },
  { id: 'auto', title: 'Confirmar automático', hint: 'La cita queda confirmada al instante, sin revisión.' },
];

export default function BookingSettings() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/admin/settings').then((r) => r.json()).then((j) => setCfg(j.cfg)); }, []);
  if (!cfg) return null;

  async function save(patch) {
    const n = { approval_mode: cfg.approval_mode || 'manual', online_lead_hours: cfg.online_lead_hours ?? 10, ...patch };
    setCfg({ ...cfg, ...n });
    const r = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'booking', ...n }),
    });
    setMsg(r.ok ? 'Guardado ✓' : 'No se pudo guardar');
    setTimeout(() => setMsg(''), 2000);
  }

  return (
    <section>
      <h2>Citas que piden las clientas</h2>
      <p className="note">Los cambios se guardan solos. {msg}</p>
      {MODES.map((m) => (
        <button key={m.id} className={'mode' + ((cfg.approval_mode || 'manual') === m.id ? ' on' : '')} onClick={() => save({ approval_mode: m.id })}>
          <strong>{m.title}</strong><small>{m.hint}</small>
        </button>
      ))}
      <label>Anticipación mínima para pedir una cita (horas)
        <input type="number" min="0" max="72" value={cfg.online_lead_hours ?? 10}
          onChange={(e) => setCfg({ ...cfg, online_lead_hours: e.target.value })}
          onBlur={(e) => save({ online_lead_hours: Math.min(72, Math.max(0, Math.round(+e.target.value || 0))) })} />
      </label>
      <p className="note">Así evitas solicitudes para dentro de pocas horas que no alcances a revisar.</p>
    </section>
  );
}
