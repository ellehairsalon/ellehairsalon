-- Seguimiento de clientes: cada servicio dice cada cuántas semanas debe volver el cliente.
-- Los valores iniciales solo se ponen la primera vez (si Elena luego deja uno vacío, no se vuelve a llenar).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'services' and column_name = 'return_weeks') then
    alter table services add column return_weeks int check (return_weeks is null or return_weeks between 1 and 104);
    update services set return_weeks = case
      when lower(name) ~ 'keratina|alisado|botox|nanoplast' then 16
      when lower(name) ~ 'mechas|balayage|rayitos|iluminaci' then 10
      when lower(name) ~ 'tinte|color|ra[ií]z|decolor' then 6
      when lower(name) ~ 'hombre|caballero|barba' then 4
      when lower(name) ~ 'corte|puntas|flequillo' then 8
      when lower(name) ~ 'tratamiento|hidrataci|mascarilla|masaje|lavado' then 6
      else null end;
  end if;
end $$;

-- Qué se hizo con cada aviso: "contacted" (ya le escribí) o "dismissed" (no volverá / ya no avisar).
-- Va ligado a la última cita terminada: cuando el cliente vuelve y termina otra, empieza un ciclo nuevo.
create table if not exists followup_actions (
  client_id uuid not null,
  appt_id uuid not null,
  action text not null check (action in ('contacted', 'dismissed')),
  at timestamptz not null default now(),
  primary key (client_id, appt_id)
);
alter table followup_actions enable row level security;
