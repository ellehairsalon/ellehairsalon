import { db } from '@/lib/slots';
import Booking from './Booking';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data } = await db.from('service_categories')
    .select('id,name,services(id,name,duration_min,price,is_active,sort_order)').order('sort_order');
  const { data: cfg } = await db.from('salon_settings').select('approval_mode,online_lead_hours,reschedule_min_hours').eq('id', 1).single();
  const categories = (data || [])
    .map((c) => ({ ...c, services: c.services.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((c) => c.services.length);
  return (
    <main>
      <h1>Elle Hair Salon</h1>
      <p className="lead">{(cfg?.approval_mode || 'manual') !== 'auto' ? 'Elige tu servicio y un horario; el salón te confirma por WhatsApp.' : 'Elige tu servicio, un horario y listo.'}</p>
      <Booking categories={categories} review={(cfg?.approval_mode || 'manual') !== 'auto'} leadHours={cfg?.online_lead_hours ?? 10} policyHours={cfg?.reschedule_min_hours ?? 10} />
    </main>
  );
}
