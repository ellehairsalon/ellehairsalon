-- Quita servicios duplicados (mismo nombre activo repetido). No borra nada: deja uno visible y oculta los demás.
-- Se queda el que tenga más citas; si empatan, el de la categoría correcta / el primero.
with ranked as (
  select s.id,
         row_number() over (
           partition by lower(btrim(s.name))
           order by (select count(*) from appointments a where a.service_id = s.id) desc, s.sort_order, s.id
         ) as rn
  from services s
  where s.is_active
)
update services set is_active = false where id in (select id from ranked where rn > 1);
