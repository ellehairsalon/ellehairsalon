'use client';
// Botón "Agendar" que abre el panel de nueva cita con la clienta ya puesta.
export default function NewApptButton({ client, services, className = 'btn primary sm', children = '＋ Agendar cita' }) {
  return <button className={className} onClick={() => window.dispatchEvent(new CustomEvent('elle:new', { detail: { client, services } }))}>{children}</button>;
}
