-- Menú minimalista v2 (ejecuta SOLO este, hayas corrido o no la 9). No borra nada: lo que no está en la lista se oculta.
-- price = 0 significa "sin precio" (no se muestra). price_from = "desde".
alter table services add column if not exists price_from boolean not null default false;
update services set is_active = false;

update service_categories set name = 'Corte' where lower(name) = 'cortes';
insert into service_categories (name, sort_order)
select 'Maquillaje', 5 where not exists (select 1 from service_categories where lower(name) = 'maquillaje');
update service_categories set sort_order = case lower(name)
  when 'corte' then 1 when 'color' then 2 when 'tratamientos' then 3 when 'peinados' then 4 when 'maquillaje' then 5 else sort_order end;

drop table if exists menu;
create temp table menu (cat text, name text, mins int, ord int, price numeric, pfrom boolean);
insert into menu values
  ('corte','Corte mujer',45,1,4.5,true), ('corte','Corte hombre',30,2,3.5,true), ('corte','Corte niño / niña',30,3,3.5,false),
  ('color','Retoque de raíz',90,1,25,true), ('color','Tinte completo',120,2,40,true),
  ('color','Rayos / iluminaciones',150,3,70,true), ('color','Balayage',180,4,100,true),
  ('tratamientos','Hidratación',60,1,15,false), ('tratamientos','Keratina',150,2,80,false),
  ('peinados','Trenzas',60,1,6,true), ('peinados','Peinado recogido',90,2,10,true), ('peinados','Ondas y rizos',60,3,8,true),
  ('maquillaje','Maquillaje social',60,1,0,false);

-- si ya existe (misma categoría y nombre) se reactiva y actualiza; si no, se crea
update services s set duration_min = m.mins, sort_order = m.ord, price = m.price, price_from = m.pfrom, is_active = true
from menu m join service_categories c on lower(c.name) = m.cat
where s.category_id = c.id and lower(s.name) = lower(m.name);

insert into services (category_id, name, duration_min, price, price_from, is_active, sort_order)
select c.id, m.name, m.mins, m.price, m.pfrom, true, m.ord
from menu m join service_categories c on lower(c.name) = m.cat
where not exists (select 1 from services s where s.category_id = c.id and lower(s.name) = lower(m.name));

-- Elena puede hacer todos los servicios nuevos
insert into stylist_services (stylist_id, service_id)
select st.id, s.id from services s cross join stylists st
where s.is_active and st.is_bookable
  and not exists (select 1 from stylist_services x where x.stylist_id = st.id and x.service_id = s.id);

-- Turno prioritario: 20% de recargo
update salon_settings set early_fee_type = 'percent', early_fee_value = 20 where id = 1;
drop table menu;
