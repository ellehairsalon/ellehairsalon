import { db } from '@/lib/slots';
import { sections } from '@/lib/menu';
import { WHATSAPP, SALON } from '@/lib/config';
import './home.css';

export const metadata = { alternates: { canonical: '/' } };

export const dynamic = 'force-dynamic';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza en lunes

const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);
const durL = (s) => `${s.approx ? 'aprox. ' : ''}${dur(s.duration_min)}`;

// Horario si la base de datos aún no lo tiene cargado.
const FALLBACK_HOURS = [
  { label: 'Lunes a viernes', text: '07:00 – 20:00' },
  { label: 'Sábado y domingo', text: '08:00 – 20:00' },
];

// Junta los días seguidos con el mismo horario: "Lunes a viernes · 07:00 – 20:00".
function groupHours(hrs) {
  if (!Array.isArray(hrs) || !hrs.length) return FALLBACK_HOURS;
  const rows = ORDER.map((wd) => {
    const h = hrs.find((x) => x.weekday === wd);
    return { wd, text: h?.is_open ? `${h.open_time.slice(0, 5)} – ${h.close_time.slice(0, 5)}` : 'Cerrado' };
  });
  const out = [];
  rows.forEach((r) => {
    const last = out[out.length - 1];
    if (last && last.text === r.text) last.to = r.wd; else out.push({ from: r.wd, to: r.wd, text: r.text });
  });
  return out.map((g) => ({
    label: g.from === g.to ? DAYS_ES[g.from] : `${DAYS_ES[g.from]} ${ORDER.indexOf(g.to) - ORDER.indexOf(g.from) === 1 ? 'y' : 'a'} ${DAYS_ES[g.to].toLowerCase()}`,
    text: g.text,
  }));
}

// Datos del negocio para Google (Maps y búsquedas) + preguntas frecuentes.
function businessJson(hrs) {
  const site = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
  const j = {
    '@context': 'https://schema.org', '@type': 'HairSalon', name: 'Elle Hair Salon', url: site,
    image: [`${site}/icon-512.png`, `${site}/fotos/espejos.jpg`, `${site}/fotos/secador.jpg`],
    description: 'Peluquería en Pujilí con más de 30 años de experiencia: cortes, color, balayage, rizos, tratamientos y peinados.',
    telephone: process.env.SALON_PHONE || `+${WHATSAPP}`,
    address: { '@type': 'PostalAddress', streetAddress: process.env.SALON_ADDRESS || SALON.address, addressLocality: process.env.SALON_CITY || 'Pujilí', addressRegion: 'Cotopaxi', addressCountry: 'EC' },
    geo: { '@type': 'GeoCoordinates', latitude: SALON.lat, longitude: SALON.lng },
    hasMap: SALON.maps, areaServed: 'Pujilí, Cotopaxi',
    sameAs: [`https://www.instagram.com/${SALON.instagram}/`],
  };
  const open = (Array.isArray(hrs) ? hrs : []).filter((h) => h.is_open);
  if (open.length) j.openingHoursSpecification = open.map((h) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS_EN[h.weekday], opens: h.open_time.slice(0, 5), closes: h.close_time.slice(0, 5) }));
  return j;
}

function faqList(policyHours) {
  return [
    ['¿Necesito cita?', 'Te recomendamos agendar: así te atendemos a tu hora y sin esperas. Si pasas por el salón sin cita, también te recibimos, según la disponibilidad del momento.'],
    ['¿Cómo agendo en línea?', 'En pocos pasos desde esta página: eliges el servicio y un horario, y solo escribes tu nombre y tu WhatsApp. El salón te confirma la cita por WhatsApp.'],
    ['¿Cuánto dura cada servicio?', 'El tiempo es aproximado y depende del largo y del estado de tu cabello. En la carta de servicios ves el tiempo de cada uno.'],
    ['¿Puedo cambiar o cancelar mi cita?', `Sí. En el mensaje de confirmación recibes un enlace para cambiarla o cancelarla, hasta ${policyHours} horas antes.`],
    ['¿Atienden a niños y a hombres?', 'Sí. Atendemos a mujeres, hombres, niñas y niños.'],
    ['¿Dónde queda el salón?', `En ${SALON.address}, ${SALON.city.split(',')[0]}. Abajo tienes el enlace a Google Maps.`],
  ];
}

const Star = () => (<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" /></svg>);

export default async function Home() {
  // Si la base de datos no responde, la página igual se muestra (sin el menú).
  const [{ data: cats }, { data: hrs }, { data: cfg }] = await Promise.all([
    db.from('service_categories').select('id,name,services(*)').order('sort_order').then((r) => r, () => ({ data: null })),
    db.from('business_hours').select('*').then((r) => r, () => ({ data: null })),
    db.from('salon_settings').select('reschedule_min_hours').eq('id', 1).maybeSingle().then((r) => r, () => ({ data: null })),
  ]);
  const categories = (cats || [])
    .map((c) => ({ ...c, services: (c.services || []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order) }))
    .filter((c) => c.services.length);
  const hours = groupHours(hrs);
  const faq = faqList(cfg?.reschedule_min_hours ?? 10);
  const ld = businessJson(hrs);
  const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  const wa = `https://wa.me/${WHATSAPP}`;
  const waBook = `${wa}?text=${encodeURIComponent('Hola Elena, quisiera agendar una cita')}`;
  const ig = `https://www.instagram.com/${SALON.instagram}/`;
  const street = `${SALON.address}, ${SALON.city.split(',')[0]}`;
  const year = new Date().getFullYear();

  return (
    <div className="home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />

      <header className="hm-top">
        <a href="/" className="hm-logo" aria-label="Elle Hair Salon, inicio"><em>Elle</em> Hair Salon</a>
        <nav className="hm-nav" aria-label="Secciones">
          <a href="#salon">El salón</a>
          <a href="#servicios">Servicios</a>
          <a href="#preguntas">Preguntas</a>
          <a href="#visitanos">Cómo llegar</a>
        </nav>
        <a href="/agendar" className="hm-btn sm">Agendar cita</a>
      </header>

      <main>
        <section className="hm-hero">
          <div className="hm-hero-main">
            <p className="hm-tag"><i aria-hidden="true" />Peluquería en Pujilí</p>
            <h1 className="hm-mast"><em>Elle</em><span>Hair Salon</span></h1>
            <p className="hm-lead">Cortes, color, rizos, tratamientos y peinados en Pujilí. Con cita te atendemos sin esperas; si pasas por el salón, también te recibimos sin cita, según el momento.</p>
            <div className="hm-actions">
              <a href="/agendar" className="hm-btn">Agendar cita</a>
              <a href="#servicios" className="hm-link">Ver los servicios</a>
            </div>
            <ul className="hm-facts">
              <li><b>+{SALON.years} años</b><span>de experiencia</span></li>
              <li><b>Para todos</b><span>mujeres, hombres y niños</span></li>
              <li><b>Con o sin cita</b><span>con cita no esperas</span></li>
            </ul>
          </div>
          <div className="hm-hero-img">
            <img src="/fotos/secador.jpg" alt="Peinado con secador y difusor en Elle Hair Salon, Pujilí" width="736" height="1300" fetchPriority="high" />
            <p className="hm-badge"><b>Con cita, sin esperas</b><span>También recibimos sin cita</span></p>
          </div>
        </section>

        <section className="hm-about" id="salon">
          <div className="hm-about-imgs">
            <img className="a" src="/fotos/espejos.jpg" alt="Interior de Elle Hair Salon: espejos ovalados, sillas y tocadores de madera" width="736" height="976" loading="lazy" />
            <img className="b" src="/fotos/peines.jpg" alt="Peines, brocha y tijeras sobre el tocador del salón" width="736" height="408" loading="lazy" />
            <p className="hm-owner"><span>{SALON.owner}</span><b>Estilista y dueña</b></p>
          </div>
          <div className="hm-about-text">
            <h2>Más de {SALON.years} años cuidando tu cabello, sin prisas.</h2>
            {/* TEXTO A TU CRITERIO: cámbialo por la historia del salón cuando quieras. */}
            <p>Elle es el salón de {SALON.owner}, en Pujilí. Con más de tres décadas de experiencia, atendemos con calma y en un espacio cómodo y sin aglomeraciones: llegas, conversamos sobre lo que buscas y trabajamos con productos profesionales.</p>
            <p>Puedes agendar tu cita en línea o pasar directamente por el salón.</p>
            <a className="hm-rating" href={SALON.maps} target="_blank" rel="noopener noreferrer">
              <b>{SALON.rating}</b>
              <span>
                <span className="hm-stars" aria-hidden="true"><Star /><Star /><Star /><Star /><Star /></span>
                de 5 en Google, con {SALON.reviews} opiniones<br /><u>Leer las opiniones</u>
              </span>
            </a>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="hm-menu" id="servicios">
            <div className="hm-menu-head">
              <h2>Servicios</h2>
              <p className="hm-note">El tiempo de cada servicio es aproximado: depende del largo y del estado de tu cabello.</p>
              {categories.length > 2 && (
                <nav className="hm-jump" aria-label="Categorías de servicios">
                  {categories.map((c) => <a key={c.id} href={`#cat-${c.id}`}>{c.name}</a>)}
                </nav>
              )}
            </div>
            <div className="hm-cats">
              {categories.map((c) => (
                <div className="hm-cat" key={c.id} id={`cat-${c.id}`}>
                  <h3>{c.name}</h3>
                  {sections(c.services).map((sec) => (
                    <div className="hm-sec" key={sec.sub || 'x'}>
                      {sec.sub && <p className="hm-sub">{sec.sub}</p>}
                      <ul>
                        {sec.cards.map((card) => (card.items.length === 1 ? (
                          <li key={card.key} className="ln">
                            <span>{card.items[0].group_name || card.items[0].name}{card.items[0].variant_label ? <small>{card.items[0].variant_label}</small> : null}</span>
                            <i aria-hidden="true" />
                            <b>{durL(card.items[0])}</b>
                          </li>
                        ) : (
                          <li key={card.key} className="multi">
                            <span>{card.key}</span>
                            <ul>
                              {card.items.map((s) => (
                                <li key={s.id} className="ln"><span>{s.variant_label || s.name}</span><i aria-hidden="true" /><b>{durL(s)}</b></li>
                              ))}
                            </ul>
                          </li>
                        )))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="hm-menu-cta">
              <a href="/agendar" className="hm-btn">Agendar cita</a>
              <a href={wa} className="hm-link" target="_blank" rel="noopener noreferrer">Preguntar por WhatsApp</a>
            </div>
          </section>
        )}

        <section className="hm-faq" id="preguntas">
          <h2>Preguntas frecuentes</h2>
          <div className="hm-faq-list">
            {faq.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        <section className="hm-visit" id="visitanos">
          <div className="hm-visit-img">
            <img src="/fotos/plancha.jpg" alt="Plancha de cabello sobre el tocador de Elle Hair Salon" width="736" height="1300" loading="lazy" />
          </div>
          <div className="hm-visit-text">
            <p className="hm-eyebrow">Visítanos</p>
            <h2>{street}.</h2>
            <a className="hm-link" href={SALON.maps} target="_blank" rel="noopener noreferrer">Cómo llegar con Google Maps</a>
            <dl className="hm-hours">
              {hours.map((h) => (<div key={h.label}><dt>{h.label}</dt><dd>{h.text}</dd></div>))}
            </dl>
            <ul className="hm-contact">
              <li><span>WhatsApp</span><a href={wa} target="_blank" rel="noopener noreferrer">{SALON.phone}</a></li>
              <li><span>Instagram</span><a href={ig} target="_blank" rel="noopener noreferrer">@{SALON.instagram}</a></li>
            </ul>
            <div className="hm-actions">
              <a href="/agendar" className="hm-btn light">Agendar cita</a>
              <a href={waBook} className="hm-link" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>
            </div>
            <p className="hm-small">Reserva en línea o visítanos directamente: con cita te atendemos sin esperas.</p>
          </div>
        </section>
      </main>

      <footer className="hm-foot">
        <div className="hm-foot-grid">
          <div>
            <p className="hm-foot-brand"><em>Elle</em> Hair Salon</p>
            <p>Peluquería en {SALON.city.split(',')[0]} con más de {SALON.years} años de experiencia.</p>
          </div>
          <div>
            <h3>Ubicación y contacto</h3>
            <p>{SALON.address}</p>
            <p>{SALON.city}</p>
            <p><a href={wa} target="_blank" rel="noopener noreferrer">{SALON.phone}</a></p>
          </div>
          <div>
            <h3>Horario</h3>
            {hours.map((h) => (<p key={h.label}>{h.label}: {h.text}</p>))}
          </div>
          <div>
            <h3>Síguenos</h3>
            <p><a href={ig} target="_blank" rel="noopener noreferrer">Instagram @{SALON.instagram}</a></p>
            <p><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
            <p><a href="/agendar">Agendar cita en línea</a></p>
          </div>
        </div>
        <p className="hm-copy">© {year} Elle Hair Salon · {SALON.city}</p>
      </footer>
    </div>
  );
}
