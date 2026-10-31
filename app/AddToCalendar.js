'use client';
import { useEffect, useState } from 'react';
const g = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Dos opciones: archivo .ics (Apple, Outlook y otros) y enlace directo a Google Calendar.
export default function AddToCalendar({ token, start, end, title }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${g(start)}/${g(end)}&details=${encodeURIComponent(`Para verla, cambiarla o cancelarla: ${origin}/cita/${token}`)}`;
  return (
    <div className="addcal">
      <span className="note">Guárdala en tu calendario</span>
      <div className="addcal-btns">
        <a className="btn soft sm" href={`/api/cita/${token}/ics`}>📅 Apple / Outlook</a>
        <a className="btn soft sm" href={gcal} target="_blank" rel="noopener noreferrer">📅 Google</a>
      </div>
    </div>
  );
}
