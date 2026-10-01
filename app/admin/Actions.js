'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Actions({ id }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action) {
    if (action === 'cancel' && !confirm('¿Cancelar esta cita?')) return;
    setBusy(true);
    await fetch('/api/admin/appt', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="actions">
      <button className="ghost" disabled={busy} onClick={() => act('complete')}>Completada</button>
      <button className="ghost" disabled={busy} onClick={() => act('no_show')}>No asistió</button>
      <button className="ghost" disabled={busy} onClick={() => act('cancel')}>Cancelar</button>
    </div>
  );
}
