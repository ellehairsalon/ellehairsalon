-- Migración 6: nota de la clienta al pedir su cita ("quiero cambiar de color", "voy con mi hija"...).
alter table appointments add column if not exists client_note text;
