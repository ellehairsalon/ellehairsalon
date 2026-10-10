-- Migración 8: "Turno prioritario" (horario temprano) con un extra incluido, editable por Elena en Ajustes.
alter table salon_settings add column if not exists early_bonus text not null default 'Lavado con masaje de cuero cabelludo';
