import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import ServicesEditor from './ServicesEditor';
import Closures from './Closures';
import ScheduleEditor from './ScheduleEditor';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  if (!(await isAdmin())) redirect('/admin/login');
  return (
    <main className="wide">
      <h1>Ajustes</h1>
      <p><a href="/pantalla" target="_blank">Abrir pantalla en vivo del salón</a></p>
      <Closures />
      <ScheduleEditor />
      <ServicesEditor />
    </main>
  );
}
