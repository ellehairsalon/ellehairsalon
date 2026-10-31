import { db } from '@/lib/slots';

export const dynamic = 'force-dynamic';

const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// Archivo .ics: lo abren Apple Calendar, Google Calendar y Outlook. Solo para citas ya confirmadas.
export async function GET(req, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('No encontrada', { status: 404 });
  const { data: row } = await db.from('appointments').select('id,group_id,status').eq('manage_token', token).maybeSingle();
  if (!row) return new Response('No encontrada', { status: 404 });
  const q = db.from('appointments').select('id,starts_at,ends_at,status,guest_name,services(name)').eq('status', 'confirmed').order('starts_at');
  const { data } = await (row.group_id ? q.eq('group_id', row.group_id) : q.eq('id', row.id));
  if (!data?.length) return new Response('Esta cita aún no está confirmada.', { status: 409 });
  const start = data[0].starts_at, end = data.reduce((m, x) => (+new Date(x.ends_at) > +new Date(m) ? x.ends_at : m), data[0].ends_at);
  const names = [...new Set(data.map((x) => x.services?.name).filter(Boolean))].join(', ');
  const origin = new URL(req.url).origin;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Elle Hair Salon//Citas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${row.group_id || row.id}@ellehairsalon`, `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`, `SUMMARY:${esc(`Elle Hair Salon · ${names}`)}`,
    `DESCRIPTION:${esc(`Tu cita en Elle Hair Salon. Para verla, cambiarla o cancelarla: ${origin}/cita/${token}`)}`,
    `URL:${origin}/cita/${token}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Cita en Elle Hair Salon', 'TRIGGER:-PT2H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="cita-elle-hair-salon.ics"', 'Cache-Control': 'no-store' } });
}
