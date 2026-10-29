-- Avisos pendientes por WhatsApp: una solicitud respondida sigue en "Pendientes"
-- hasta que Elena toca el botón de WhatsApp (o marca que ya avisó de otra forma).
alter table appointments add column if not exists notify_kind text;
create index if not exists appointments_notify_idx on appointments (notify_kind) where notify_kind is not null;
