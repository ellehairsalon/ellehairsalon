-- Migración 21: seguridad. Activa RLS (Row Level Security) en TODAS las tablas públicas que aún no lo tengan.
-- Pégala completa en Supabase > SQL Editor > New query > Run. Se puede correr más de una vez sin problema.
--
-- Qué hace: sin RLS, cualquiera que consiga la dirección del proyecto y la clave pública ("anon") podría leer
-- las tablas (clientas, citas, teléfonos). Con RLS activado y sin políticas, esa puerta queda cerrada.
-- El sitio sigue funcionando igual, porque el servidor usa la clave "service_role", que no pasa por RLS.

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    raise notice 'RLS activado en: %', t.relname;
  end loop;
end $$;

-- Comprobación: esta consulta debe devolver "true" en la columna rls para todas las tablas.
select c.relname as tabla, c.relrowsecurity as rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
