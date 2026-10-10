'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText, rejectText } from '@/lib/wa';
import { svcEmoji } from '@/lib/emoji';
import { money } from '@/lib/priority';

const TZ = 'America/Guayaquil';
const dayLabel = (iso) => {
  const t = new Date(iso).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).replace(/\./g, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const hmx = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
  return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};
const initials = (n = '') => n.trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('');
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export default function Inbox({ items, hours = 10, bonus }) {
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
  const forget = (id) => setTimeout(() => setDone((d) => { const n = { ...d }; delete n[id]; return n; }), 600);

  return (
    <>
      {error && <p className="error">{error}</p>}
      {shown.length === 0 && (
        <div className="empty"><div className="empty-ico">🎉</div><b>Todo al día</b><span>No hay solicitudes por confirmar.</span></div>
      )}
      {shown.map((a) => {
        const st = done[a.id]?.state;
        const people = a.people || [a];
        const total = people.reduce((n, x) => n + +x.price + +x.early_fee, 0);
        return (
          <div className={'req' + (st ? ' ' + st : '')} key={a.id}>
            <div className="req-head">
              <div className="avatar">{initials(a.clients.full_name)}</div>
              <div className="req-who">
                <b>{a.clients.full_name}</b>
                <a href={`https://wa.me/${a.clients.phone.replace(/\D/g, '')}`}>{a.clients.phone}</a>
              </div>
              <span className="ago">{ago(a.created_at)}</span>
            </div>

            <div className="req-when">
              <span className="req-day">{dayLabel(a.starts_at)}</span>
              <span className="req-hour">{hmx(a.starts_at)}</span>
              {a.early_fee > 0 && <span className="chip-prio">🌅 Prioritario +{money(a.early_fee)}</span>}
            </div>

            <div className="req-items">
              {people.map((x, i) => (
                <div className="req-item" key={i}>
                  <span className="emo">{svcEmoji(x.services.name, x.services.service_categories?.name)}</span>
                  <div className="who">
                    <b>{x.services.name}</b>
                    <small>{people.length > 1 ? `${x.guest_name || a.clients.full_name.split(' ')[0]} · ${hmx(x.starts_at)} · ` : ''}{dur(x.services.duration_min)}</small>
                  </div>
                  <span className="price">{money(x.price)}</span>
                </div>
              ))}
              <div className="req-total"><span>Total</span><b>{money(total)}</b></div>
            </div>

            {a.client_note && <div className="req-note">📝 {a.client_note}</div>}

            {!st && ask !== a.id && (
              <div className="req-actions">
                <button className="cta ok" disabled={busy} onClick={() => answer(a, 'confirm')}>✓ Confirmar</button>
                <button className="ghost" disabled={busy} onClick={() => setAsk(a.id)}>No puedo / otra hora</button>
              </div>
            )}
            {!st && ask === a.id && (
              <div className="req-ask">
                <p>¿Rechazar esta solicitud? Se libera el horario.</p>
                <div className="req-actions">
                  <button className="cta" disabled={busy} onClick={() => answer(a, 'reject')}>Sí, rechazar</button>
                  <button className="ghost" onClick={() => setAsk(null)}>Volver</button>
                </div>
              </div>
            )}
            {st === 'confirmed' && (
              <div className="req-done">
                <p>✓ Confirmada. Falta avisarle al cliente:</p>
                <a className="cta wa" href={waLink(a.clients.phone, confirmText(a, origin, hours, a.people, bonus))} onClick={() => forget(a.id)}>Enviar confirmación por WhatsApp</a>
              </div>
            )}
            {st === 'rejected' && (
              <div className="req-done">
                <p>Solicitud rechazada. Falta avisarle al cliente:</p>
                <a className="cta wa" href={waLink(a.clients.phone, rejectText(a, origin, a.people))} onClick={() => forget(a.id)}>Avisar por WhatsApp (proponer otra hora)</a>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
