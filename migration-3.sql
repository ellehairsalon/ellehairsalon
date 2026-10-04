-- Migración 3: permitir clientas en atención al mismo tiempo (Elena puede atender otra mientras una espera).
alter table appointments add column if not exists overlap_ok boolean not null default false;

-- Quita la regla anterior que prohibía todo traslape (sin importar su nombre)...
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'appointments'::regclass and contype = 'x' loop
    execute format('alter table appointments drop constraint %I', c);
  end loop;
end $$;

-- ...y la vuelve a crear: sigue prohibiendo traslapes, salvo en las citas marcadas como simultáneas.
alter table appointments add constraint no_overlap_per_stylist exclude using gist (
  stylist_id with =,
  tstzrange(starts_at, ends_at) with &&
) where (status = 'confirmed' and not overlap_ok);
