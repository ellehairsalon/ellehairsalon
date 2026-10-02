import './globals.css';

export const metadata = {
  title: 'Elle Hair Salon · Agenda tu cita',
  description: 'Reserva tu cita en Elle Hair Salon.',
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Elle' },
};
export const viewport = { themeColor: '#8e1b4a' };

export default function RootLayout({ children }) {
  return (<html lang="es"><body>{children}</body></html>);
}
