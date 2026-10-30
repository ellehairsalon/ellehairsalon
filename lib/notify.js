import { db } from '@/lib/slots';

// ¿Ya se corrió la migración que crea esta columna? Así el panel sigue funcionando aunque se despliegue antes que el SQL.
const cache = {};
function supported(col) {
  if (cache[col] === undefined) {
    cache[col] = db.from('appointments').select(col).limit(1).then(({ error }) => !error, () => false)
      .then((ok) => { if (!ok) setTimeout(() => { delete cache[col]; }, 60000); return ok; });
  }
  return cache[col];
}
export const notifySupported = () => supported('notify_kind'); // migration-14
export const paySupported = () => supported('paid_amount'); // migration-15
