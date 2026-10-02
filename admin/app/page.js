import { db } from '@/lib/slots';
import Booking from './Booking';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data } = await db.from('service_categories')
    .select('id,name,services(id,name,duration_min,price,is_active,sort_order)').order('sort_order');
  const categories = (data || [])
    .map((c) => ({ ...c, services: c.services.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((c) => c.services.length);
  return (
    <main>
      <h1>Elle Hair Salon</h1>
      <p className="lead">Elige tu servicio, un horario y listo.</p>
      <Booking categories={categories} />
    </main>
  );
}
