-- Migración 4: datos de contacto y notas internas de cada clienta.
alter table clients add column if not exists email text;
alter table clients add column if not exists cedula text;
alter table clients add column if not exists internal_notes text;
