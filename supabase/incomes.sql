-- Ejecutar en Supabase SQL Editor.
-- Crea categorias de ingresos y tabla de ingresos con impacto en saldo bancario.

create table if not exists public.income_categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(40) not null,
  category_name varchar(40) not null default 'General',
  subcategory_name varchar(40) not null default 'General',
  description varchar(180),
  created_by uuid references auth.users (id),
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.income_categories
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

alter table public.income_categories
  add column if not exists category_name varchar(40);

alter table public.income_categories
  add column if not exists subcategory_name varchar(40);

update public.income_categories
set category_name = coalesce(
  nullif(trim(split_part(name, '/', 1)), ''),
  nullif(trim(name), ''),
  'General'
)
where category_name is null or trim(category_name) = '';

update public.income_categories
set subcategory_name = coalesce(
  nullif(trim(split_part(name, '/', 2)), ''),
  'General'
)
where subcategory_name is null or trim(subcategory_name) = '';

alter table public.income_categories
  alter column category_name set default 'General';

alter table public.income_categories
  alter column subcategory_name set default 'General';

alter table public.income_categories
  alter column category_name set not null;

alter table public.income_categories
  alter column subcategory_name set not null;

update public.income_categories
set name = trim(category_name) || ' / ' || trim(subcategory_name)
where name is null
   or trim(name) = ''
   or position('/' in name) = 0;

create unique index if not exists uq_income_categories_name_lower
on public.income_categories ((lower(name)));

create unique index if not exists uq_income_categories_pair_lower
on public.income_categories ((lower(category_name)), (lower(subcategory_name)));

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  income_date date not null default current_date,
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.income_categories (id) on delete restrict,
  destination_bank_account_id uuid references public.bank_accounts (id) on delete restrict,
  payment_method_id uuid references public.payment_methods (id) on delete restrict,
  payment_method varchar(40) not null default 'Transferencia',
  description text not null default '',
  registered_by uuid references public.profiles (id) on delete set null,
  registered_by_name text not null default '',
  registered_by_email text,
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.incomes
  add column if not exists income_date date not null default current_date;

alter table public.incomes
  add column if not exists destination_bank_account_id uuid references public.bank_accounts (id) on delete restrict;

alter table public.incomes
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete restrict;

alter table public.incomes
  add column if not exists payment_method varchar(40) not null default 'Transferencia';

alter table public.incomes
  add column if not exists registered_by uuid references public.profiles (id) on delete set null;

alter table public.incomes
  add column if not exists registered_by_name text not null default '';

alter table public.incomes
  add column if not exists registered_by_email text;

alter table public.incomes
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create index if not exists idx_incomes_created_at_desc on public.incomes (created_at desc);
create index if not exists idx_incomes_income_date on public.incomes (income_date desc);
create index if not exists idx_incomes_category_id on public.incomes (category_id);
create index if not exists idx_incomes_destination_bank_account_id on public.incomes (destination_bank_account_id);
create index if not exists idx_incomes_payment_method_id on public.incomes (payment_method_id);

update public.incomes i
set payment_method_id = pm.id
from public.payment_methods pm
where i.payment_method_id is null
  and i.payment_method is not null
  and lower(trim(i.payment_method)) = lower(trim(pm.name));

create or replace function public.set_income_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_income_categories_updated_at on public.income_categories;
create trigger trg_income_categories_updated_at
before update on public.income_categories
for each row
execute function public.set_income_categories_updated_at();

create or replace function public.set_incomes_audit_fields()
returns trigger
language plpgsql
as $$
declare
  v_full_name text;
  v_email text;
  v_payment_method_name text;
  v_destination_account_id uuid;
begin
  if new.payment_method_id is not null then
    select pm.name, pm.bank_account_id
      into v_payment_method_name, v_destination_account_id
    from public.payment_methods pm
    where pm.id = new.payment_method_id;

    if v_payment_method_name is null then
      raise exception 'Medio de pago invalido.';
    end if;

    new.payment_method := v_payment_method_name;
    new.destination_bank_account_id := v_destination_account_id;
  end if;

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

drop trigger if exists trg_incomes_audit_fields on public.incomes;
create trigger trg_incomes_audit_fields
before insert or update on public.incomes
for each row
execute function public.set_incomes_audit_fields();

create or replace function public.apply_income_bank_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.destination_bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance + new.amount
      where id = new.destination_bank_account_id;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.destination_bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance - old.amount
      where id = old.destination_bank_account_id;
    end if;

    if new.destination_bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance + new.amount
      where id = new.destination_bank_account_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.destination_bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance - old.amount
      where id = old.destination_bank_account_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_incomes_apply_bank_balance on public.incomes;
create trigger trg_incomes_apply_bank_balance
after insert or update or delete on public.incomes
for each row
execute function public.apply_income_bank_balance();

alter table public.income_categories enable row level security;
alter table public.incomes enable row level security;

drop policy if exists "income_categories_select_approved" on public.income_categories;
create policy "income_categories_select_approved"
on public.income_categories
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

drop policy if exists "income_categories_insert_manager" on public.income_categories;
create policy "income_categories_insert_manager"
on public.income_categories
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

drop policy if exists "income_categories_update_manager" on public.income_categories;
create policy "income_categories_update_manager"
on public.income_categories
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

drop policy if exists "income_categories_delete_manager" on public.income_categories;
create policy "income_categories_delete_manager"
on public.income_categories
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
);

drop policy if exists "incomes_select_approved" on public.incomes;
create policy "incomes_select_approved"
on public.incomes
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

drop policy if exists "incomes_insert_approved" on public.incomes;
create policy "incomes_insert_approved"
on public.incomes
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

drop policy if exists "incomes_update_manager" on public.incomes;
create policy "incomes_update_manager"
on public.incomes
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

drop policy if exists "incomes_delete_manager" on public.incomes;
create policy "incomes_delete_manager"
on public.incomes
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'admin')
      and (p.is_approved = true or p.role = 'owner')
  )
);
