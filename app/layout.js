import '@fontsource-variable/playfair-display/index.css';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/albert-sans/index.css';
import '@fontsource-variable/albert-sans/wght-italic.css';
import './globals.css';

const SITE = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
const DESC = 'Reserva tu cita en Elle Hair Salon en pocos pasos: elige tu servicio y tu horario, y el salón te confirma por WhatsApp.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: 'Elle Hair Salon · Agenda tu cita',
  description: DESC,
  openGraph: { title: 'Elle Hair Salon · Agenda tu cita', description: DESC, url: '/', siteName: 'Elle Hair Salon', locale: 'es_EC', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Elle Hair Salon · Agenda tu cita', description: DESC },
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Elle' },
};
export const viewport = { themeColor: '#b05a36' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
