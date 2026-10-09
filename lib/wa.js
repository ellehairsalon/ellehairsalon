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

export function confirmText(a, origin, hours = 10) {
  return `Hola ${first(a.clients.full_name)} 💇‍♀️ Tu cita en Elle Hair Salon está confirmada:\n\n` +
    `${a.services.name}\n${when(a.starts_at)} a las ${hour(a.starts_at)}\n` +
    (a.early_fee > 0 ? `(Incluye $${a.early_fee} de recargo por horario temprano)\n` : '') +
    `\nSi necesitas cambiarla o cancelarla, hazlo antes del ${deadline(a, hours)} aquí: ${origin}/cita/${a.manage_token}\n\n¡Te esperamos!`;
}

export function rejectText(a, origin) {
  return `Hola ${first(a.clients.full_name)}, gracias por escribirnos a Elle Hair Salon. ` +
    `Lamentablemente no tenemos disponible ${when(a.starts_at)} a las ${hour(a.starts_at)} para ${a.services.name}. ` +
    `¿Te acomoda otro día u horario? Puedes elegir uno nuevo aquí: ${origin}/ o respóndenos por este chat y lo coordinamos.`;
}
