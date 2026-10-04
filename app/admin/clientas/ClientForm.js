'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export default function ClientForm({ client }) {
  const router = useRouter();
  const [f, setF] = useState({
    full_name: client.full_name || '', phone: client.phone || '', email: client.email || '', cedula: client.cedula || '',
    birthday_day: client.birthday_day || '', birthday_month: client.birthday_month || '', internal_notes: client.internal_notes || '',
  });
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setMsg(''); };

  async function save() {
    setBusy(true); setMsg('');
    const r = await fetch('/api/admin/client', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: client.id, ...f }),
    });
    const j = await r.json();
    setBusy(false);
    setOk(r.ok);
    setMsg(r.ok ? 'Guardado ✓' : j.error);
    if (r.ok) router.refresh();
  }

  return (
    <section>
      <h2>Datos</h2>
      <label>Nombre<input value={f.full_name} onChange={set('full_name')} /></label>
      <label>WhatsApp<input value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
      <label>Correo<input type="email" value={f.email} onChange={set('email')} /></label>
      <label>Cédula, RUC o pasaporte (para facturar)<input value={f.cedula} onChange={set('cedula')} inputMode="numeric" /></label>
      <label>Cumpleaños
        <div className="grid">
          <select value={f.birthday_day} onChange={set('birthday_day')}>
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select>
          <select value={f.birthday_month} onChange={set('birthday_month')}>
            <option value="">Mes</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </label>
      <label>Notas fijas de la clienta (medidas, fórmula del tinte, preferencias)
        <textarea rows={5} value={f.internal_notes} onChange={set('internal_notes')}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: 10, border: '1px solid var(--line)', background: '#fff', font: 'inherit', color: 'var(--ink)' }} />
      </label>
      {msg && <p className={ok ? 'note' : 'error'}>{msg}</p>}
      <button className="cta" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar datos'}</button>
    </section>
  );
}
