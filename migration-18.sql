-- Inventario v2: marca, código de color, tamaño del envase y nuevas categorías.
-- Es seguro correrla más de una vez.

alter table inventory_items add column if not exists brand text;
alter table inventory_items add column if not exists code text;
alter table inventory_items add column if not exists size_amt numeric;
alter table inventory_items add column if not exists size_unit text;
create index if not exists inventory_items_brand_code_idx on inventory_items (category, brand, code);

-- 1) Reclasificar lo que Elena ya había cargado --------------------------------

-- Peróxidos (botellas de 1000 ml). Marca y volumen salen del nombre.
update inventory_items set
  category = 'Peróxidos',
  brand = case when name ~* 'yellow' then 'Yellow' when name ~* 'salon\s*in' then 'Salon In' when name ~* 'alfaparf' then 'Alfaparf' else brand end,
  code = coalesce((regexp_match(name, '(\d+)\s*vol', 'i'))[1], code),
  unit = 'botellas', size_amt = 1000, size_unit = 'ml'
where name ~* '^(peroxide|per[oó]xido|oxidante)';

-- Shampoo y acondicionador para cabello teñido
update inventory_items set
  category = 'Cuidado del color',
  brand = case when name ~* 'yellow' then 'Yellow' when name ~* 'salon\s*in' then 'Salon In' when name ~* 'alfaparf' then 'Alfaparf' else brand end
where category <> 'Peróxidos' and name ~* '(shampoo|shapoo|shapo|acondicionador|conditioner)';

-- Rizos
update inventory_items set category = 'Rizos'
where name ~* '(neutralizante|ondulante)';

-- Tintes (tubos de 60 gr). El código sale del nombre: "Tinte 6.66 Rubio ..."
update inventory_items set
  category = 'Tintes',
  code = (regexp_match(name, '^tinte\s+(\S+)', 'i'))[1],
  unit = 'tubos', size_amt = 60, size_unit = 'gr'
where category <> 'Peróxidos' and name ~* '^tinte\s+\S+';

-- Lo que quedó en "Color" sin clasificar pasa a Tintes
update inventory_items set category = 'Tintes' where category = 'Color';

-- 2) Catálogo inicial de tintes (leído de la hoja del 2026-08-31) --------------
-- Las cantidades son las de la hoja: en el primer conteo Elena las confirma o corrige.
-- Los colores que Elena ya había cargado a mano SIEMPRE conservan su cantidad (es más reciente que la hoja).

create temp table if not exists _seed (brand text, code text, name text, qty numeric) on commit drop;
truncate _seed;

insert into _seed (brand, code, qty) values
  -- Yellow
  ('Yellow','1',1),('Yellow','2',2),('Yellow','4',3),('Yellow','4.00',2),('Yellow','5',1),
  ('Yellow','7.00',2),('Yellow','8.00',1),
  ('Yellow','1.11',2),('Yellow','6.1',2),('Yellow','9.1',1),('Yellow','9.2',1),('Yellow','6.11',1),
  ('Yellow','7.11',1),('Yellow','7.21',2),('Yellow','8.21',5),('Yellow','10.21',1),
  ('Yellow','4.665',1),('Yellow','7.4',5),('Yellow','8.4',2),('Yellow','7.45',1),('Yellow','4.65',1),('Yellow','5.65',1),
  ('Yellow','5.32',3),('Yellow','6.32',2),('Yellow','7.32',5),('Yellow','8.32',4),('Yellow','5.35',1),
  ('Yellow','6.35',2),('Yellow','7.37',3),('Yellow','7.53',1),('Yellow','0.00',3),('Yellow','4.5',1),
  ('Yellow','9.8',1),('Yellow','6.51',1),
  ('Yellow','7.3',1),('Yellow','7.31',5),('Yellow','7.13',2),('Yellow','11.11',1),('Yellow','11.20',3),
  ('Yellow','11.21',5),('Yellow','0.55',5),('Yellow','6.7',5),('Yellow','6.23',2),('Yellow','7.17',3),('Yellow','9.17',3),
  -- Alfaparf
  ('Alfaparf','9.01',1),('Alfaparf','8.4',1),('Alfaparf','7.4',2),('Alfaparf','6.45',3),('Alfaparf','6.4',4),
  ('Alfaparf','5.22',5),('Alfaparf','5.35',1),('Alfaparf','6.35',4),
  ('Alfaparf','9.13',1),('Alfaparf','11.21',2),('Alfaparf','0.55',2),('Alfaparf','6.7',3),('Alfaparf','6.23',1),
  -- Salon In
  ('Salon In','1',2),('Salon In','3',6),('Salon In','7',1),('Salon In','7.1',3),('Salon In','9.1',3),
  ('Salon In','9.07',1),('Salon In','6.99',2),
  ('Salon In','6.66',1),('Salon In','6.6',1),('Salon In','7.45',1),('Salon In','8.4',2),
  ('Salon In','1.35',4),('Salon In','5.35',1),('Salon In','6.35',1),('Salon In','5.25',4),('Salon In','5.42',1),
  ('Salon In','9.13',2);
update _seed set name = 'Tinte ' || code;

insert into _seed (brand, name, code, qty) values
  ('Alfaparf','Tinte Magenta','Magenta',2),
  ('Alfaparf','Tinte True Blue','True Blue',2),
  ('Salon In','Tinte Pearl Dream .21','Pearl Dream',1),
  ('Salon In','Tinte Sweet Violet .2','Sweet Violet',1),
  ('Salon In','Tinte Igora Violet','Igora Violet',1);

-- (a) Un color ya cargado sin marca cuyo código existe en UNA sola marca de la hoja: se le asigna esa marca.
update inventory_items i set brand = u.brand
from (select code, min(brand) as brand from _seed group by code having count(distinct brand) = 1) u
where i.is_active and i.category = 'Tintes' and i.brand is null and i.code = u.code;

-- (b) El resto del catálogo se agrega si esa marca todavía no tiene ese código.
insert into inventory_items (name, category, brand, code, qty, min_qty, unit, size_amt, size_unit)
select s.name, 'Tintes', s.brand, s.code, s.qty, 1, 'tubos', 60, 'gr'
from _seed s
where not exists (
  select 1 from inventory_items i
  where i.is_active and i.category = 'Tintes' and i.code = s.code and i.brand = s.brand
);
