-- Límite de intentos (login del panel y reservas públicas). Guarda solo una marca por intento, se limpia sola.
create table if not exists rate_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  at timestamptz not null default now()
);
create index if not exists rate_hits_bucket_at on rate_hits (bucket, at desc);
alter table rate_hits enable row level security;
