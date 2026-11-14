-- Menú nuevo (nov 2026): categorías, tiempos nuevos, variantes por largo de cabello y servicios largos que pueden cruzar el almuerzo.
-- No borra nada. Los servicios que se renombran conservan su precio y su historial de citas; los nuevos quedan sin precio (0 = no se muestra).
-- Se puede correr más de una vez sin duplicar.

alter table services add column if not exists group_name text;          -- título de la tarjeta (ej. "Coloración")
alter table services add column if not exists variant_label text;       -- opción dentro de la tarjeta (ej. "Corto")
alter table services add column if not exists subgroup text;            -- subtítulo dentro de la categoría (ej. "Mujer")
alter table services add column if not exists can_cross_lunch boolean not null default false;
alter table services add column if not exists approx boolean not null default false; -- muestra "aprox."

-- Categorías
update service_categories set name = 'Cortes' where lower(name) = 'corte';
update service_categories set name = 'Maquillaje y manos' where lower(name) = 'maquillaje';
insert into service_categories (name, sort_order)
select 'Rizos y alineamiento', 3 where not exists (select 1 from service_categories where lower(name) = 'rizos y alineamiento');
update service_categories set sort_order = case lower(name)
  when 'cortes' then 1 when 'color' then 2 when 'rizos y alineamiento' then 3 when 'tratamientos' then 4
  when 'peinados' then 5 when 'maquillaje y manos' then 6 else sort_order end;

do $$
declare r record; sid bigint; cid bigint;
begin
  drop table if exists _menu;
  create temp table _menu (cat text, old_name text, name text, grp text, variant text, sub text, mins int, ord int, approx boolean, cross_l boolean);
  insert into _menu values
    -- Cortes
    ('cortes', null,               'Corte clásico · mujer, cabello corto',                          'Corte clásico', 'Corto',        'Mujer', 30, 1, false, false),
    ('cortes', 'Corte mujer',      'Corte clásico · mujer, cabello medio y largo',                  'Corte clásico', 'Medio y largo','Mujer', 40, 2, false, false),
    ('cortes', null,               'Corte de diseño y texturización · mujer, cabello medio y largo','Corte de diseño y texturización','Cabello medio y largo','Mujer', 75, 3, false, false),
    ('cortes', 'Corte hombre',     'Corte clásico · hombre',                                        'Corte clásico', null,           'Hombre',30, 4, false, false),
    ('cortes', null,               'Corte degradado · hombre',                                      'Corte degradado', null,         'Hombre',60, 5, false, false),
    ('cortes', 'Corte niño / niña','Corte infantil',                                                'Corte infantil', null,          'Niños y niñas', 30, 6, false, false),
    -- Color
    ('color', null,                'Coloración · cabello corto',   'Coloración', 'Corto', null, 150, 1, false, false),
    ('color', 'Tinte completo',    'Coloración · cabello medio',   'Coloración', 'Medio', null, 195, 2, false, false),
    ('color', null,                'Coloración · cabello largo',   'Coloración', 'Largo', null, 255, 3, false, false),
    ('color', 'Rayos / iluminaciones','Iluminaciones',             'Iluminaciones', null, null, 360, 4, true, true),
    ('color', 'Balayage',          'Balayage',                     'Balayage', null, null, 480, 5, true, true),
    -- Rizos y alineamiento
    ('rizos y alineamiento', 'Ondas y rizos','Rizos · cabello corto',       'Rizos', 'Corto',       null, 210, 1, false, false),
    ('rizos y alineamiento', null,           'Rizos · cabello medio-largo', 'Rizos', 'Medio-largo', null, 270, 2, true,  false),
    ('rizos y alineamiento', null,           'Alineamiento capilar · cabello medio','Alineamiento capilar','Medio', null, 300, 3, true, true),
    ('rizos y alineamiento', null,           'Alineamiento capilar · cabello largo','Alineamiento capilar','Largo', null, 480, 4, true, true),
    -- Tratamientos
    ('tratamientos', 'Hidratación', 'Tratamiento capilar: nutrición, hidratación o células madre', 'Tratamiento capilar: nutrición, hidratación o células madre', null, null, 90, 1, false, false),
    -- Peinados
    ('peinados', null, 'Cepillado · cabello corto',  'Cepillado', 'Corto', null, 20, 1, false, false),
    ('peinados', null, 'Cepillado · cabello medio',  'Cepillado', 'Medio', null, 30, 2, false, false),
    ('peinados', null, 'Cepillado · cabello largo',  'Cepillado', 'Largo', null, 45, 3, false, false),
    ('peinados', null, 'Planchado · cabello medio',  'Planchado', 'Medio', null, 20, 4, false, false),
    ('peinados', null, 'Planchado · cabello largo',  'Planchado', 'Largo', null, 45, 5, false, false),
    ('peinados', 'Peinado recogido','Peinado recogido','Peinado recogido', null, null, 45, 6, false, false),
    ('peinados', 'Trenzas',         'Trenzas',         'Trenzas', null, null, 45, 7, false, false),
    -- Maquillaje y manos
    ('maquillaje y manos', 'Maquillaje social','Maquillaje social','Maquillaje social', null, null, 30, 1, false, false),
    ('maquillaje y manos', null, 'Manicura básica o francesa','Manicura básica o francesa', null, null, 20, 2, false, false);

  for r in select * from _menu order by cat, ord loop
    select id into cid from service_categories where lower(name) = r.cat limit 1;
    sid := null;
    if r.old_name is not null then
      select id into sid from services where lower(name) = lower(r.old_name) order by id limit 1;
    end if;
    if sid is null then
      select id into sid from services where lower(name) = lower(r.name) order by id limit 1;
    end if;
    if sid is null then
      insert into services (category_id, name, duration_min, price, price_from, is_active, sort_order, group_name, variant_label, subgroup, can_cross_lunch, approx)
      values (cid, r.name, r.mins, 0, false, true, r.ord, r.grp, r.variant, r.sub, r.cross_l, r.approx);
    else
      update services set category_id = cid, name = r.name, duration_min = r.mins, is_active = true, sort_order = r.ord,
        group_name = r.grp, variant_label = r.variant, subgroup = r.sub, can_cross_lunch = r.cross_l, approx = r.approx
      where id = sid;
    end if;
  end loop;
  drop table if exists _menu;
end $$;

-- Se desactivan (no se borran: el historial de citas se conserva)
update services set is_active = false where lower(name) in ('retoque de raíz', 'keratina');

-- Elena puede hacer todos los servicios nuevos
insert into stylist_services (stylist_id, service_id)
select st.id, s.id from services s cross join stylists st
where s.is_active and st.is_bookable
  and not exists (select 1 from stylist_services x where x.stylist_id = st.id and x.service_id = s.id);
