import { db } from '@/lib/slots';
import Booking from './Booking';
import { DEFAULT_BONUS } from '@/lib/priority';

export const dynamic = 'force-dynamic';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Datos del negocio para Google (Maps y búsquedas). Dirección y teléfono se ponen en Vercel (SALON_ADDRESS, SALON_CITY, SALON_PHONE); si no están, no se publican.
async function businessJson() {
  const { data: hrs } = await db.from('business_hours').select('*');
  const site = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
  const j = { '@context': 'https://schema.org', '@type': 'HairSalon', name: 'Elle Hair Salon', url: site, image: `${site}/icon-512.png`, priceRange: '$$' };
  if (process.env.SALON_PHONE) j.telephone = process.env.SALON_PHONE;
  if (process.env.SALON_ADDRESS) j.address = { '@type': 'PostalAddress', streetAddress: process.env.SALON_ADDRESS, addressLocality: process.env.SALON_CITY || undefined, addressCountry: 'EC' };
  const open = (Array.isArray(hrs) ? hrs : []).filter((h) => h.is_open);
  if (open.length) j.openingHoursSpecification = open.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[h.weekday], opens: h.open_time.slice(0, 5), closes: h.close_time.slice(0, 5) }));
  return j;
}

export default async function Page({ searchParams }) {
  const sp = (await searchParams) || {};
  const showPrices = sp.precios === '1';
  const { data } = await db.from('service_categories')
    .select('id,name,services(id,name,duration_min,price,price_from,is_active,sort_order)').order('sort_order');
  const { data: cfg } = await db.from('salon_settings').select('approval_mode,online_lead_hours,reschedule_min_hours,early_fee_type,early_fee_value,early_bonus').eq('id', 1).single();
  const categories = (data || [])
    .map((c) => ({ ...c, services: c.services.filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((c) => c.services.length);
  const ld = await businessJson().catch(() => null);
  return (
    <main>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />}
      <header className="head">
      <p className="eyebrow">Agenda tu cita</p>
      <h1>Elle <em>Hair Salon</em></h1>
      <p className="lead">{(cfg?.approval_mode || 'manual') !== 'auto' ? 'Elige tu servicio y un horario; el salón te confirma por WhatsApp.' : 'Elige tu servicio, un horario y listo.'}</p>
      </header>
      <Booking showPrices={showPrices} categories={categories} review={(cfg?.approval_mode || 'manual') !== 'auto'} leadHours={cfg?.online_lead_hours ?? 10} policyHours={cfg?.reschedule_min_hours ?? 10}
        priority={{ type: cfg?.early_fee_type || 'fixed', value: cfg?.early_fee_value ?? 5, bonus: cfg?.early_bonus || DEFAULT_BONUS }} />
    </main>
  );
}
