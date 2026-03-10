-- Ejecutar en Supabase SQL Editor.
-- Crea catalogo de productos y log de ventas (presencial / TikTok Live).

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name varchar(90) not null,
  product_type varchar(40) not null,
  category varchar(40) not null,
  sku varchar(40),
  price numeric(14,2) not null check (price >= 0),
  base_cost numeric(14,2) not null default 0 check (base_cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  sales_units integer not null default 0 check (sales_units >= 0),
  sales_total numeric(14,2) not null default 0 check (sales_total >= 0),
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create unique index if not exists uq_products_name_lower
on public.products ((lower(name)));

create unique index if not exists uq_products_sku_lower
on public.products ((lower(sku)))
where sku is not null and length(trim(sku)) > 0;

create index if not exists idx_products_created_at_desc on public.products (created_at desc);
create index if not exists idx_products_is_active on public.products (is_active);

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'sale_channel' and n.nspname = 'public'
  ) then
    create type public.sale_channel as enum ('presencial', 'tiktok_live');
  end if;
end;
$$;

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sale_channel public.sale_channel not null default 'presencial',
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  registered_by uuid references public.profiles (id) on delete set null,
  registered_by_name text not null default '',
  registered_by_email text,
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.product_sales
  add column if not exists registered_by uuid references public.profiles (id) on delete set null;

alter table public.product_sales
  add column if not exists registered_by_name text not null default '';

alter table public.product_sales
  add column if not exists registered_by_email text;

alter table public.product_sales
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create index if not exists idx_product_sales_created_at_desc on public.product_sales (created_at desc);
create index if not exists idx_product_sales_product_id on public.product_sales (product_id);
create index if not exists idx_product_sales_channel on public.product_sales (sale_channel);

create or replace function public.set_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

create or replace function public.set_product_sales_audit_and_totals()
returns trigger
language plpgsql
as $$
declare
  v_full_name text;
  v_email text;
begin
  new.total_amount := (new.quantity * new.unit_price);

  if new.registered_by is null then
    new.registered_by := auth.uid();
  end if;

  if new.registered_by = auth.uid() then
    select p.full_name, p.email
      into v_full_name, v_email
    from public.profiles p
    where p.id = auth.uid();

    if v_full_name is not null then
      new.registered_by_name := v_full_name;
    end if;

    if v_email is not null then
      new.registered_by_email := v_email;
    end if;
  end if;

  if new.created_by_app is null then
    new.created_by_app := 'OMNI AGENCIA S.A.C.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_product_sales_audit_and_totals on public.product_sales;
create trigger trg_product_sales_audit_and_totals
before insert or update on public.product_sales
for each row
execute function public.set_product_sales_audit_and_totals();

create or replace function public.apply_product_sale_to_stock_and_metrics()
returns trigger
language plpgsql
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Operacion no soportada para aplicar ventas de producto.';
  end if;

  update public.products
  set stock = stock - new.quantity,
      sales_count = sales_count + 1,
      sales_units = sales_units + new.quantity,
      sales_total = sales_total + new.total_amount,
      updated_at = now()
  where id = new.product_id
    and is_active = true
    and stock >= new.quantity;

  if not found then
    raise exception 'Stock insuficiente o producto inactivo.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_product_sales_apply_to_product on public.product_sales;
create trigger trg_product_sales_apply_to_product
after insert on public.product_sales
for each row
execute function public.apply_product_sale_to_stock_and_metrics();

alter table public.products enable row level security;
alter table public.product_sales enable row level security;

drop policy if exists "products_select_approved" on public.products;
create policy "products_select_approved"
on public.products
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "products_insert_manager" on public.products;
create policy "products_insert_manager"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "products_update_manager" on public.products;
create policy "products_update_manager"
on public.products
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "products_delete_owner" on public.products;
create policy "products_delete_owner"
on public.products
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "product_sales_select_approved" on public.product_sales;
create policy "product_sales_select_approved"
on public.product_sales
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "product_sales_insert_approved" on public.product_sales;
create policy "product_sales_insert_approved"
on public.product_sales
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin', 'vendedor', 'contador')
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "product_sales_update_manager" on public.product_sales;
create policy "product_sales_update_manager"
on public.product_sales
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "product_sales_delete_owner" on public.product_sales;
create policy "product_sales_delete_owner"
on public.product_sales
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and (p.is_approved = true or p.role = 'owner')
  )
);
