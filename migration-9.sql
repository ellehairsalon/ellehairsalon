-- Menú minimalista. Precios de lista (0 = sin precio: lo define Elena en el salón). No borra nada: los servicios viejos se ocultan.
alter table services add column if not exists price_from boolean not null default false;
update services set is_active = false;

update service_categories set name = 'Corte' where lower(name) = 'cortes';
insert into service_categories (name, sort_order)
select 'Maquillaje', 5 where not exists (select 1 from service_categories where lower(name) = 'maquillaje');
update service_categories set sort_order = case lower(name)
  when 'corte' then 1 when 'color' then 2 when 'tratamientos' then 3 when 'peinados' then 4 when 'maquillaje' then 5 else sort_order end;

with m(cat, name, mins, ord, price, pfrom) as (values
  ('corte','Corte mujer',45,1,4.5,false), ('corte','Corte hombre',30,2,3.5,false), ('corte','Corte niño / niña',30,3,3.5,false),
  ('color','Diagnóstico de color',30,1,0,false), ('color','Retoque de raíz',90,2,0,false), ('color','Tinte completo',120,3,0,false),
  ('color','Rayos / iluminaciones',150,4,70,true), ('color','Balayage',180,5,100,true),
  ('tratamientos','Hidratación',60,1,15,false), ('tratamientos','Keratina',150,2,80,false),
  ('peinados','Peinado corto',45,1,4,false), ('peinados','Peinado de evento',90,2,10,false),
  ('peinados','Trenzas',60,3,0,false), ('peinados','Ondas / rizos',60,4,0,false),
  ('maquillaje','Maquillaje social',60,1,0,false)
), ins as (
  insert into services (category_id, name, duration_min, price, price_from, is_active, sort_order)
  select c.id, m.name, m.mins, m.price, m.pfrom, true, m.ord from m join service_categories c on lower(c.name) = m.cat
  returning id
)
insert into stylist_services (stylist_id, service_id)
select s.id, ins.id from ins cross join stylists s where s.is_bookable
on conflict do nothing;
