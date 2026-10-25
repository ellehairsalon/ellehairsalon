import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/hanken-grotesk/index.css';
import './globals.css';

export const metadata = {
  title: 'Elle Hair Salon · Agenda tu cita',
  description: 'Reserva tu cita en Elle Hair Salon.',
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
