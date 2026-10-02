'use client';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/admin', label: 'Hoy', icon: '📅' },
  { href: '/admin/clientas', label: 'Clientas', icon: '👤' },
];

export default function TabBar() {
  const p = usePathname();
  if (p.startsWith('/admin/login')) return null;
  return (
    <nav className="tabbar">
      {tabs.map((t) => {
        const on = t.href === '/admin' ? p === '/admin' : p.startsWith(t.href);
        return <a key={t.href} href={t.href} className={on ? 'on' : ''}><span>{t.icon}</span>{t.label}</a>;
      })}
    </nav>
  );
}
