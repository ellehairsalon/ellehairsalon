-- Inventario del salón: productos con cantidad actual y mínimo para avisar "se está acabando".
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Otros',
  qty numeric not null default 0 check (qty >= 0),
  min_qty numeric not null default 1 check (min_qty >= 0),
  unit text not null default 'unidades',
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table inventory_items enable row level security;
create index if not exists inventory_items_cat_idx on inventory_items (category, name);
