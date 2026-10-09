'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText, rejectText } from '@/lib/wa';

const when = (iso) => new Date(iso).toLocaleString('es-EC', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil',
});
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

export default function Inbox({ items, hours = 10 }) {
  const router = useRouter();
  const [done, setDone] = useState({}); // id -> { state: 'confirmed' | 'rejected', item }: ya respondida, falta enviar el WhatsApp
  const [ask, setAsk] = useState(null); // id de la solicitud que se está por rechazar
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function answer(a, action) {
    setBusy(true); setError('');
    const r = await fetch('/api/admin/appt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, action }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || 'No se pudo completar.'); router.refresh(); return; }
    setAsk(null);
    setDone((d) => ({ ...d, [a.id]: { state: action === 'confirm' ? 'confirmed' : 'rejected', item: a } }));
    router.refresh(); // actualiza el contador de la barra
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // Las ya respondidas se quedan en pantalla hasta que Elena toque "Enviar", para que no se olvide el mensaje.
  const shown = items.concat(Object.values(done).map((d) => d.item).filter((it) => !items.some((x) => x.id === it.id)));

  return (
    <>
      {error && <p className="error">{error}</p>}
      {shown.length === 0 && <p className="note" style={{ marginTop: 24 }}>No hay solicitudes por confirmar. 🎉</p>}
      {shown.map((a) => {
        const st = done[a.id]?.state;
        return (
          <div className="bday" key={a.id} style={{ marginTop: 14 }}>
            <strong>{a.clients.full_name}</strong> <span className="note">· {a.clients.phone} · pidió {ago(a.created_at)}</span>
            <p style={{ margin: '6px 0' }}>
              {a.services.name}<br />
              <b style={{ textTransform: 'capitalize' }}>{when(a.starts_at)}</b>
              {a.client_note && <><br /><span>📝 {a.client_note}</span></>}
              {a.early_fee > 0 && <><br /><span className="note">Incluye ${a.early_fee} de horario temprano</span></>}
            </p>
            {!st && ask !== a.id && (
              <div className="actions">
                <button className="cta" disabled={busy} onClick={() => answer(a, 'confirm')}>Confirmar</button>
                <button className="ghost" disabled={busy} onClick={() => setAsk(a.id)}>No puedo / otra hora</button>
              </div>
            )}
            {!st && ask === a.id && (
              <>
                <p>¿Rechazar esta solicitud? Se libera el horario.</p>
                <div className="actions">
                  <button className="cta" disabled={busy} onClick={() => answer(a, 'reject')}>Sí, rechazar</button>
                  <button className="ghost" onClick={() => setAsk(null)}>Volver</button>
                </div>
              </>
            )}
            {st === 'confirmed' && (
              <>
                <p>✓ Confirmada. Falta avisarle a la clienta:</p>
                <div className="actions">
                  <a className="cta" style={{ textDecoration: 'none', textAlign: 'center', color: '#fff' }} href={waLink(a.clients.phone, confirmText(a, origin, hours))}
                    onClick={() => setTimeout(() => setDone((d) => { const n = { ...d }; delete n[a.id]; return n; }), 600)}>Enviar confirmación por WhatsApp</a>
                </div>
              </>
            )}
            {st === 'rejected' && (
              <>
                <p>Solicitud rechazada. Falta avisarle a la clienta:</p>
                <div className="actions">
                  <a className="cta" style={{ textDecoration: 'none', textAlign: 'center', color: '#fff' }} href={waLink(a.clients.phone, rejectText(a, origin))}
                    onClick={() => setTimeout(() => setDone((d) => { const n = { ...d }; delete n[a.id]; return n; }), 600)}>Avisar por WhatsApp (proponer otra hora)</a>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
