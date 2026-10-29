import { db } from '@/lib/slots';

// ¿Ya se corrió migration-14 (columna notify_kind)? Así el panel sigue funcionando aunque se despliegue antes que el SQL.
let cached;
export function notifySupported() {
  if (cached === undefined) {
    cached = db.from('appointments').select('notify_kind').limit(1).then(({ error }) => !error, () => false)
      .then((ok) => { if (!ok) setTimeout(() => { cached = undefined; }, 60000); return ok; });
  }
  return cached;
}
