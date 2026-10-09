'use client';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin', label: 'Hoy', icon: '📅' },
  { href: '/admin/pendientes', label: 'Solicitudes', icon: '📥' },
  { href: '/admin/semana', label: 'Semana', icon: '🗓️' },
  { href: '/admin/clientas', label: 'Clientas', icon: '👤' },
  { href: '/admin/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export default function TabBar({ pending = 0 }) {
  const p = usePathname();
  if (p.startsWith('/admin/login')) return null;
  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const on = t.href === '/admin' ? p === '/admin' : p.startsWith(t.href);
        return <a key={t.href} href={t.href} className={on ? 'on' : ''}><span>{t.icon}{t.href === '/admin/pendientes' && pending > 0 && <i className="badge">{pending}</i>}</span>{t.label}</a>;
      })}
    </nav>
  );
}
