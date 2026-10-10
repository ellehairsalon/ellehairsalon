-- Migración 7: reservas para varias personas (mamá + esposo + niño) en una sola solicitud.
-- Pégala completa en Supabase > SQL Editor > New query > Run.

-- 1) Qué citas van juntas y a nombre de quién
alter table appointments add column if not exists group_id uuid;
alter table appointments add column if not exists guest_name text;   -- null = la persona que reserva
create index if not exists appointments_group_idx on appointments (group_id) where group_id is not null;

-- 2) Una clienta sigue teniendo una sola reserva activa, pero esa reserva puede incluir invitados.
--    La regla ahora cuenta solo la cita de la clienta (guest_name vacío), no la de sus invitados.
drop index if exists one_active_appointment_per_client;
create unique index one_active_appointment_per_client
  on appointments (client_id)
  where status in ('confirmed','pending') and guest_name is null;
