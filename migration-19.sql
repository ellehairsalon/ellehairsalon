-- Hora de almuerzo: no se ofrecen turnos ni se cruzan citas con este rango. Elena puede cambiarlo en Ajustes → Horario.
alter table business_hours add column if not exists lunch_start time;
alter table business_hours add column if not exists lunch_end time;
update business_hours set lunch_start = '13:00', lunch_end = '14:00' where is_open and lunch_start is null;
