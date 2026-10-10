// Mensajes de WhatsApp listos para enviar (Elena solo toca "Enviar").
const TZ = 'America/Guayaquil';
const when = (iso) => new Date(iso).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const hour = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const first = (n = '') => n.trim().split(' ')[0];
const digits = (p = '') => p.replace(/\D/g, '');

export const waLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;

const deadline = (a, hours) => {
  const d = new Date(+new Date(a.starts_at) - hours * 3600000);
  return `${d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })} a las ${hour(d.toISOString())}`;
};

// items: todas las citas de la reserva cuando fue para varias personas (opcional)
const lines = (items, fallback) => (items && items.length > 1
  ? items.map((x) => `• ${x.guest_name || first(x.clients?.full_name || fallback)}: ${x.services.name} (${hour(x.starts_at)})`).join('\n') + '\n'
  : null);

export function confirmText(a, origin, hours = 10, items) {
  const list = lines(items, a.clients.full_name);
  const early = items && items.length > 1 ? items.reduce((n, x) => n + +x.early_fee, 0) : a.early_fee;
  return `Hola ${first(a.clients.full_name)} 💇‍♀️ Tu cita en Elle Hair Salon está confirmada:\n\n` +
    (list ? `${when(a.starts_at)} a las ${hour(a.starts_at)}\n${list}` : `${a.services.name}\n${when(a.starts_at)} a las ${hour(a.starts_at)}\n`) +
    (early > 0 ? `(Incluye $${early} de recargo por horario temprano)\n` : '') +
    `\nSi necesitas cambiarla o cancelarla, hazlo antes del ${deadline(a, hours)} aquí: ${origin}/cita/${a.manage_token}\n\n¡Te esperamos!`;
}

export function rejectText(a, origin, items) {
  const many = items && items.length > 1;
  return `Hola ${first(a.clients.full_name)}, gracias por escribirnos a Elle Hair Salon. ` +
    `Lamentablemente no tenemos disponible ${when(a.starts_at)} a las ${hour(a.starts_at)} ${many ? 'para todos' : `para ${a.services.name}`}. ` +
    `¿Te acomoda otro día u horario? Puedes elegir uno nuevo aquí: ${origin}/ o respóndenos por este chat y lo coordinamos.`;
}
