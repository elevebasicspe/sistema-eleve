-- Ejecutar en Supabase SQL Editor.
-- Crea categorias de gasto y tabla de gastos para vistas, filtros y reportes.

create table if not exists public.expense_categories (
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

alter table public.expense_categories
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

alter table public.expense_categories
  add column if not exists category_name varchar(40);

alter table public.expense_categories
  add column if not exists subcategory_name varchar(40);

update public.expense_categories
set category_name = coalesce(
  nullif(trim(split_part(name, '/', 1)), ''),
  nullif(trim(name), ''),
  'General'
)
where category_name is null or trim(category_name) = '';

update public.expense_categories
set subcategory_name = coalesce(
  nullif(trim(split_part(name, '/', 2)), ''),
  'General'
)
where subcategory_name is null or trim(subcategory_name) = '';

alter table public.expense_categories
  alter column category_name set default 'General';

alter table public.expense_categories
  alter column subcategory_name set default 'General';

alter table public.expense_categories
  alter column category_name set not null;

alter table public.expense_categories
  alter column subcategory_name set not null;

update public.expense_categories
set name = trim(category_name) || ' / ' || trim(subcategory_name)
where name is null
   or trim(name) = ''
   or position('/' in name) = 0;

create unique index if not exists uq_expense_categories_name_lower
on public.expense_categories ((lower(name)));

create unique index if not exists uq_expense_categories_pair_lower
on public.expense_categories ((lower(category_name)), (lower(subcategory_name)));

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  amount numeric(14,2) not null check (amount >= 0),
  category_id uuid references public.expense_categories (id) on delete restrict,
  bank_account_id uuid references public.bank_accounts (id) on delete restrict,
  description text not null default '',
  registered_by uuid references public.profiles (id) on delete set null,
  registered_by_name text not null default '',
  registered_by_email text,
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses
  add column if not exists expense_date date not null default current_date;

alter table public.expenses
  add column if not exists registered_by uuid references public.profiles (id) on delete set null;

alter table public.expenses
  add column if not exists bank_account_id uuid references public.bank_accounts (id) on delete restrict;

alter table public.expenses
  add column if not exists registered_by_name text not null default '';

alter table public.expenses
  add column if not exists registered_by_email text;

alter table public.expenses
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create index if not exists idx_expenses_created_at_desc on public.expenses (created_at desc);
create index if not exists idx_expenses_expense_date on public.expenses (expense_date desc);
create index if not exists idx_expenses_category_id on public.expenses (category_id);
create index if not exists idx_expenses_bank_account_id on public.expenses (bank_account_id);

create or replace function public.set_expense_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_expense_categories_updated_at on public.expense_categories;
create trigger trg_expense_categories_updated_at
before update on public.expense_categories
for each row
execute function public.set_expense_categories_updated_at();

create or replace function public.set_expenses_audit_fields()
returns trigger
language plpgsql
as $$
declare
  v_full_name text;
  v_email text;
begin
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

drop trigger if exists trg_expenses_audit_fields on public.expenses;
create trigger trg_expenses_audit_fields
before insert or update on public.expenses
for each row
execute function public.set_expenses_audit_fields();

create or replace function public.apply_expense_bank_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance - new.amount
      where id = new.bank_account_id
        and current_balance >= new.amount;

      if not found then
        raise exception 'Saldo insuficiente o cuenta bancaria invalida.';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance + old.amount
      where id = old.bank_account_id;
    end if;

    if new.bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance - new.amount
      where id = new.bank_account_id
        and current_balance >= new.amount;

      if not found then
        raise exception 'Saldo insuficiente o cuenta bancaria invalida.';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.bank_account_id is not null then
      update public.bank_accounts
      set current_balance = current_balance + old.amount
      where id = old.bank_account_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_expenses_apply_bank_balance on public.expenses;
create trigger trg_expenses_apply_bank_balance
after insert or update or delete on public.expenses
for each row
execute function public.apply_expense_bank_balance();

alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "expense_categories_select_approved" on public.expense_categories;
create policy "expense_categories_select_approved"
on public.expense_categories
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

drop policy if exists "expense_categories_insert_manager" on public.expense_categories;
create policy "expense_categories_insert_manager"
on public.expense_categories
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

drop policy if exists "expense_categories_update_manager" on public.expense_categories;
create policy "expense_categories_update_manager"
on public.expense_categories
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

drop policy if exists "expense_categories_delete_manager" on public.expense_categories;
create policy "expense_categories_delete_manager"
on public.expense_categories
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

drop policy if exists "expenses_select_approved" on public.expenses;
create policy "expenses_select_approved"
on public.expenses
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

drop policy if exists "expenses_insert_approved" on public.expenses;
create policy "expenses_insert_approved"
on public.expenses
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

drop policy if exists "expenses_update_manager" on public.expenses;
create policy "expenses_update_manager"
on public.expenses
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

drop policy if exists "expenses_delete_manager" on public.expenses;
create policy "expenses_delete_manager"
on public.expenses
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
