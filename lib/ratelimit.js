import { db } from '@/lib/slots';

// Límite de intentos por dirección. Usa la tabla rate_hits (migration-17); si aún no existe,
// cae a un contador en memoria (menos fuerte, pero nunca rompe el sitio).
const mem = new Map();
let tableOk;

export const clientIp = (req) =>
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida';

async function hasTable() {
  if (tableOk === undefined) tableOk = await db.from('rate_hits').select('id').limit(1).then(({ error }) => !error, () => false);
  return tableOk;
}

// ¿Ya superó `max` intentos en los últimos `windowSec` segundos? Si no, anota este intento.
export async function tooMany(bucket, max, windowSec) {
  const since = Date.now() - windowSec * 1000;
  try {
    if (await hasTable()) {
      const { count } = await db.from('rate_hits').select('id', { count: 'exact', head: true }).eq('bucket', bucket).gte('at', new Date(since).toISOString());
      if ((count || 0) >= max) return true;
      await db.from('rate_hits').insert({ bucket });
      if (Math.random() < 0.02) await db.from('rate_hits').delete().lt('at', new Date(Date.now() - 864e5).toISOString()); // limpieza ocasional
      return false;
    }
  } catch { /* cae a memoria */ }
  const hits = (mem.get(bucket) || []).filter((t) => t > since);
  if (hits.length >= max) { mem.set(bucket, hits); return true; }
  hits.push(Date.now()); mem.set(bucket, hits);
  return false;
}
