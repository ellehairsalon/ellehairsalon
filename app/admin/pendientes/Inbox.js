'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { waLink, confirmText, rejectText, proposeText, changeOkText, changeNoText } from '@/lib/wa';
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

export default function Inbox({ items, hours = 10, bonus, feeType = 'fixed', feeValue = 0 }) {
  const router = useRouter();
  const [done, setDone] = useState({}); // id -> { state: 'confirmed' | 'rejected', item }: ya respondida, falta enviar el WhatsApp
  const [ask, setAsk] = useState(null); // id de la solicitud que se está por rechazar
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [prop, setProp] = useState(null); // { id, date, slots, pick }: eligiendo otra hora para proponer
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - 5 * 3600000 + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    const wd = new Date(iso + 'T12:00:00Z').toLocaleDateString('es-EC', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
    return { iso, wd: i === 0 ? 'Hoy' : wd.charAt(0).toUpperCase() + wd.slice(1), n: +iso.slice(8) };
  }), []);

  // Después de mover la reserva a la nueva hora, el mensaje de WhatsApp debe hablar de la hora nueva.
  const moved = (a, iso) => {
    const shift = +new Date(iso) - +new Date(a.starts_at);
    const people = (a.people || [a]).map((x) => ({ ...x, starts_at: new Date(+new Date(x.starts_at) + shift).toISOString() }));
    return { ...a, starts_at: iso, people };
  };

  async function answer(a, action, extra = {}) {
    setBusy(true); setError('');
    const r = await fetch('/api/admin/appt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, action, ...extra }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(j.error || 'No se pudo completar.'); router.refresh(); return; }
    setAsk(null); setProp(null);
    const state = { confirm: 'confirmed', reject: 'rejected', propose: 'proposed', confirm_change: 'changed', reject_change: 'kept' }[action];
    const item = action === 'propose' ? moved(a, extra.starts_at) : action === 'confirm_change' ? moved(a, a.new_starts_at) : a;
    if (action === 'withdraw') { router.refresh(); return; }
    setDone((d) => ({ ...d, [a.id]: { state, item } }));
    router.refresh(); // actualiza el contador de la barra
  }

  // Los 3 horarios libres más cercanos a lo que pidió el cliente: un toque y listo.
  async function openSuggest(a) {
    setProp({ id: a.id, date: null, slots: null, pick: null });
    const r = await fetch(`/api/admin/propose?id=${a.id}`);
    const j = await r.json().catch(() => ({}));
    setProp((p) => (p && p.id === a.id && !p.date ? { ...p, slots: j.slots || [] } : p));
  }

  async function pickDate(a, date) {
    setProp({ id: a.id, date, slots: null, pick: null });
    const r = await fetch(`/api/admin/propose?id=${a.id}&date=${date}`);
    const j = await r.json().catch(() => ({}));
    setProp((p) => (p && p.id === a.id && p.date === date ? { ...p, slots: j.slots || [] } : p));
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
        return (
          <div className={'req' + (st ? ' ' + st : '') + (a.early || a.early_fee > 0 ? ' early' : '')} key={a.id}>
            <div className="req-head">
              <div className="avatar">{initials(a.clients.full_name)}</div>
              <div className="req-who">
                <b>{a.clients.full_name}</b>
                <a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${a.clients.phone.replace(/\D/g, '')}`}>{a.clients.phone}</a>
              </div>
              <span className="ago">{ago(a.created_at)}</span>
            </div>

            {a.kind === 'proposal' && !st && (
              <div className="req-change wait">
                <b>⏳ Esperando que el cliente acepte</b>
                <span>Pidió: {dayLabel(a.starts_at)} · {hmx(a.starts_at)}</span>
              </div>
            )}
            {a.kind === 'change' && !st && (
              <div className="req-change">
                <b>🔁 Quiere cambiar su cita</b>
                <span>Ahora: {dayLabel(a.starts_at)} · {hmx(a.starts_at)}</span>
              </div>
            )}
            <div className="req-when">
              <span className="req-day">{dayLabel(a.kind !== 'new' ? a.new_starts_at : a.starts_at)}</span>
              <span className="req-hour">{hmx(a.kind !== 'new' ? a.new_starts_at : a.starts_at)}</span>
              {(a.early || a.early_fee > 0) && <span className="chip-prio">🌅 Prioritario {feeType === 'percent' ? `+${+feeValue}%` : a.early_fee > 0 ? `+${money(a.early_fee)}` : ''}</span>}
            </div>

            <div className="req-items">
              {people.map((x, i) => (
                <div className="req-item" key={i}>
                  <span className="emo">{svcEmoji(x.services.name, x.services.service_categories?.name)}</span>
                  <div className="who">
                    <b>{x.services.name}</b>
                    <small>{people.length > 1 ? `${x.guest_name || a.clients.full_name.split(' ')[0]} · ${hmx(a.kind !== 'new' && x.change_starts_at ? x.change_starts_at : x.starts_at)} · ` : ''}{dur(x.services.duration_min)}</small>
                  </div>
                </div>
              ))}
            </div>

            {a.client_note && <div className="req-note">📝 {a.client_note}</div>}

            {!st && a.kind === 'proposal' && (
              <div className="req-actions">
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, proposeText(moved(a, a.new_starts_at), origin, a.people.length > 1 ? moved(a, a.new_starts_at).people : null))}>Reenviar propuesta por WhatsApp</a>
                <button className="ghost" disabled={busy} onClick={() => answer(a, 'withdraw')}>Retirar propuesta</button>
              </div>
            )}
            {!st && a.kind !== 'proposal' && ask !== a.id && prop?.id !== a.id && (
              <div className="req-actions">
                <button className="cta ok" disabled={busy} onClick={() => answer(a, a.kind === 'change' ? 'confirm_change' : 'confirm')}>{a.kind === 'change' ? '✓ Confirmar el cambio' : '✓ Confirmar'}</button>
                {a.kind === 'change'
                  ? <button className="ghost" disabled={busy} onClick={() => setAsk(a.id)}>No puedo</button>
                  : <button className="ghost" disabled={busy} onClick={() => openSuggest(a)}>No puedo / otra hora</button>}
              </div>
            )}
            {!st && prop?.id === a.id && !prop.date && (
              <div className="req-prop">
                <p><b>Propón otra hora</b> · toca una y se la enviamos por WhatsApp</p>
                {prop.slots === null && <p className="note">Buscando los horarios más cercanos…</p>}
                {prop.slots?.length === 0 && <p className="note">No encontré horarios libres en los próximos días.</p>}
                <div className="sug">
                  {prop.slots?.map((x) => (
                    <button key={x.starts_at} className={'sug-btn' + (x.early ? ' early' : '')} disabled={busy} onClick={() => answer(a, 'propose', { starts_at: x.starts_at })}>
                      <small>{dayLabel(x.starts_at)}</small><b>{hmx(x.starts_at)}</b>{x.early && <i>🌅</i>}
                    </button>
                  ))}
                </div>
                <div className="req-actions">
                  <button className="ghost" onClick={() => pickDate(a, strip[0].iso)}>Elegir otro día</button>
                  <button className="ghost" onClick={() => setProp(null)}>Volver</button>
                </div>
                <button className="lnk" onClick={() => { setProp(null); setAsk(a.id); }}>Rechazar sin proponer hora</button>
              </div>
            )}
            {!st && prop?.id === a.id && prop.date && (
              <div className="req-prop">
                <p><b>Elige otro día y hora</b> · el cliente la acepta con un toque</p>
                <div className="na-days">
                  {strip.map((d) => (
                    <button key={d.iso} className={'na-day' + (prop.date === d.iso ? ' on' : '')} onClick={() => pickDate(a, d.iso)}>
                      <small>{d.wd}</small><b>{d.n}</b>
                    </button>
                  ))}
                </div>
                {prop.slots === null && <p className="note">Buscando horarios…</p>}
                {prop.slots?.length === 0 && <p className="note">No hay horarios libres ese día.</p>}
                <div className="na-times">
                  {prop.slots?.map((x) => (
                    <button key={x.starts_at} className={'na-time' + (x.early ? ' early' : '') + (prop.pick === x.starts_at ? ' sel' : '')} onClick={() => setProp({ ...prop, pick: x.starts_at })}>{x.time}</button>
                  ))}
                </div>
                <div className="req-actions">
                  <button className="cta ok" disabled={busy || !prop.pick} onClick={() => answer(a, 'propose', { starts_at: prop.pick })}>
                    {prop.pick ? `Proponer ${dayLabel(prop.pick)} · ${hmx(prop.pick)}` : 'Elige una hora'}
                  </button>
                  <button className="ghost" onClick={() => openSuggest(a)}>Volver</button>
                </div>
              </div>
            )}
            {!st && ask === a.id && (
              <div className="req-ask">
                <p>{a.kind === 'change' ? 'El cliente se queda con su cita original. ¿No puedes hacer el cambio?' : '¿Rechazar esta solicitud? Se libera el horario.'}</p>
                <div className="req-actions">
                  <button className="cta" disabled={busy} onClick={() => answer(a, a.kind === 'change' ? 'reject_change' : 'reject')}>{a.kind === 'change' ? 'Sí, mantener la original' : 'Sí, rechazar'}</button>
                  <button className="ghost" onClick={() => setAsk(null)}>Volver</button>
                </div>
              </div>
            )}
            {st === 'confirmed' && (
              <div className="req-done">
                <p>✓ Confirmada. Falta avisarle al cliente:</p>
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, confirmText(a, origin, hours, a.people, bonus))} onClick={() => forget(a.id)}>Enviar confirmación por WhatsApp</a>
              </div>
            )}
            {st === 'proposed' && (
              <div className="req-done">
                <p>✓ Propuesta lista. Falta enviársela al cliente por WhatsApp:</p>
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, proposeText(a, origin, a.people.length > 1 ? a.people : null))} onClick={() => forget(a.id)}>Enviar propuesta por WhatsApp</a>
              </div>
            )}
            {st === 'changed' && (
              <div className="req-done">
                <p>✓ Cambio confirmado. Falta avisarle al cliente:</p>
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, changeOkText(a, origin, hours, a.people.length > 1 ? a.people : null))} onClick={() => forget(a.id)}>Enviar confirmación por WhatsApp</a>
              </div>
            )}
            {st === 'kept' && (
              <div className="req-done">
                <p>Se mantiene la cita original. Falta avisarle al cliente:</p>
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, changeNoText(a, origin))} onClick={() => forget(a.id)}>Avisar por WhatsApp</a>
              </div>
            )}
            {st === 'rejected' && (
              <div className="req-done">
                <p>Solicitud rechazada. Falta avisarle al cliente:</p>
                <a target="_blank" rel="noopener noreferrer" className="cta wa" href={waLink(a.clients.phone, rejectText(a, origin, a.people))} onClick={() => forget(a.id)}>Avisar por WhatsApp</a>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
