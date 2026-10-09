-- Migración 5: solicitudes de cita que Elena revisa y confirma.
-- Pégala completa en Supabase > SQL Editor > New query > Run.

-- 1) Ajustes nuevos
alter table salon_settings add column if not exists approval_mode text not null default 'manual';
alter table salon_settings add column if not exists online_lead_hours int not null default 10;
do $$ begin
  alter table salon_settings add constraint approval_mode_ok check (approval_mode in ('manual','mixed','auto'));
exception when duplicate_object then null; end $$;

-- 2) Nuevo estado "pending" (solicitud por confirmar). Se quita la regla anterior de estados y se crea otra.
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'appointments'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table appointments drop constraint %I', c);
  end loop;
end $$;
alter table appointments add constraint appointments_status_ok
  check (status in ('pending','confirmed','cancelled','completed','no_show'));

-- 3) Una solicitud pendiente también aparta el horario (no se traslapa con otra cita)
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'appointments'::regclass and contype = 'x' loop
    execute format('alter table appointments drop constraint %I', c);
  end loop;
end $$;
alter table appointments add constraint no_overlap_per_stylist exclude using gist (
  stylist_id with =,
  tstzrange(starts_at, ends_at) with &&
) where (status in ('confirmed','pending') and not overlap_ok);

-- 4) Una clienta solo puede tener una cita o solicitud activa a la vez
drop index if exists one_active_appointment_per_client;
create unique index one_active_appointment_per_client
  on appointments (client_id) where status in ('confirmed','pending');
