import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import ServicesEditor from './ServicesEditor';
import Closures from './Closures';
import ScheduleEditor from './ScheduleEditor';
import BookingSettings from './BookingSettings';

export const dynamic = 'force-dynamic';

// Cada sección empieza cerrada: Elena abre solo lo que va a cambiar.
const Fold = ({ title, children }) => (
  <details className="fold"><summary>{title}</summary>{children}</details>
);

export default async function Settings() {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <main className="wide">
      <h1>Ajustes</h1>
      <p><a href="/pantalla" target="_blank">Abrir pantalla en vivo del salón</a></p>
      <Fold title="Citas que piden las clientas"><BookingSettings /></Fold>
      <Fold title="Servicios y precios"><ServicesEditor /></Fold>
      <Fold title="Horario de atención"><ScheduleEditor /></Fold>
      <Fold title="Cerrar horarios"><Closures /></Fold>
    </main>
  );
}
