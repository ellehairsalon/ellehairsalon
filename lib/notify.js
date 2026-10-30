import { db } from '@/lib/slots';

// ¿Ya se corrió la migración que crea esta columna o tabla? Así el panel sigue funcionando aunque se despliegue antes que el SQL.
const cache = {};
function supported(table, col) {
  const k = `${table}.${col}`;
  if (cache[k] === undefined) {
    cache[k] = db.from(table).select(col).limit(1).then(({ error }) => !error, () => false)
      .then((ok) => { if (!ok) setTimeout(() => { delete cache[k]; }, 60000); return ok; });
  }
  return cache[k];
}
export const notifySupported = () => supported('appointments', 'notify_kind'); // migration-14
export const paySupported = () => supported('appointments', 'paid_amount'); // migration-15
export const followSupported = () => supported('services', 'return_weeks'); // migration-16
export const followActionsSupported = () => supported('followup_actions', 'client_id'); // migration-16
