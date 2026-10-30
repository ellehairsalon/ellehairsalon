-- Registro de cobro: cuánto cobró Elena al terminar la cita y cómo le pagaron.
alter table appointments add column if not exists paid_amount numeric check (paid_amount >= 0);
alter table appointments add column if not exists paid_method text;
alter table appointments add column if not exists paid_at timestamptz;
create index if not exists appointments_paid_idx on appointments (paid_at) where paid_amount is not null;
