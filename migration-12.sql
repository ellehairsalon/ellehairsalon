-- Cambios de cita que Elena debe volver a confirmar: la cita original sigue confirmada hasta que ella responda.
alter table appointments add column if not exists change_starts_at timestamptz;
alter table appointments add column if not exists change_ends_at timestamptz;
alter table appointments add column if not exists change_stylist_id uuid;
alter table appointments add column if not exists change_early_fee numeric;
alter table appointments add column if not exists change_requested_at timestamptz;
create index if not exists appointments_change_idx on appointments (change_starts_at) where change_starts_at is not null;
