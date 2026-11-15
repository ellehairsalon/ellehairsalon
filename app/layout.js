import '@fontsource-variable/bodoni-moda/opsz.css';
import '@fontsource-variable/bodoni-moda/opsz-italic.css';
import '@fontsource-variable/albert-sans/index.css';
import '@fontsource-variable/albert-sans/wght-italic.css';
import './globals.css';

const SITE = process.env.SITE_URL || 'https://ellehairsalon.vercel.app';
const DESC = 'Elle Hair Salon, en Pujilí: cortes, color, rizos, tratamientos y peinados. Conoce los servicios y agenda tu cita en línea.';

export const metadata = {
  metadataBase: new URL(SITE),
  title: 'Elle Hair Salon · Peluquería en Pujilí',
  description: DESC,
  openGraph: { title: 'Elle Hair Salon · Peluquería en Pujilí', description: DESC, url: '/', siteName: 'Elle Hair Salon', locale: 'es_EC', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Elle Hair Salon · Peluquería en Pujilí', description: DESC },
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
