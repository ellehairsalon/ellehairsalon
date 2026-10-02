import { db } from '@/lib/slots';

// Tarea diaria (4:00 a.m. Ecuador): cierra las citas ya pasadas y mantiene activo el proyecto de Supabase.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  const { error } = await db.from('appointments').update({ status: 'completed' })
    .eq('status', 'confirmed').lt('ends_at', new Date().toISOString());
  return Response.json({ ok: !error });
}
