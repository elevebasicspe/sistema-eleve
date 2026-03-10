-- Ejecuta este script en Supabase SQL Editor.
-- Cuentas bancarias + medios de pago vinculados.

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name varchar(15) not null,
  bank_name varchar(15),
  account_type varchar(15),
  account_number varchar(30),
  cci varchar(30),
  currency varchar(6) not null,
  holder_name varchar(120),
  holder_dni varchar(8),
  current_balance numeric(14,2) not null default 0,
  created_by uuid references auth.users (id),
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bank_accounts
  add column if not exists current_balance numeric(14,2) not null default 0;

alter table public.bank_accounts
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

alter table public.bank_accounts
  alter column bank_name drop not null;

alter table public.bank_accounts
  alter column account_type drop not null;

alter table public.bank_accounts
  alter column account_number drop not null;

alter table public.bank_accounts
  alter column cci drop not null;

alter table public.bank_accounts
  alter column holder_name drop not null;

alter table public.bank_accounts
  alter column holder_dni drop not null;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_account_number_digits;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_cci_digits;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_holder_dni_digits;

alter table public.bank_accounts
  add constraint bank_accounts_account_number_digits
  check (account_number is null or account_number ~ '^[0-9]+$');

alter table public.bank_accounts
  add constraint bank_accounts_cci_digits
  check (cci is null or cci ~ '^[0-9]+$');

alter table public.bank_accounts
  add constraint bank_accounts_holder_dni_digits
  check (holder_dni is null or holder_dni ~ '^[0-9]{8}$');

-- Nombre unico e irrepetible (case-insensitive).
create unique index if not exists uq_bank_accounts_name_lower
on public.bank_accounts ((lower(name)));

create index if not exists idx_bank_accounts_created_at
on public.bank_accounts (created_at desc);

create or replace function public.set_bank_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bank_accounts_updated_at on public.bank_accounts;
create trigger trg_bank_accounts_updated_at
before update on public.bank_accounts
for each row
execute function public.set_bank_accounts_updated_at();

-- Cuenta base de efectivo.
insert into public.bank_accounts (
  name,
  bank_name,
  account_type,
  account_number,
  cci,
  currency,
  holder_name,
  holder_dni,
  current_balance,
  created_by
)
select
  'Efectivo',
  null,
  'Efectivo',
  null,
  null,
  'PEN',
  null,
  null,
  0,
  null
where not exists (
  select 1
  from public.bank_accounts
  where lower(name) = 'efectivo'
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name varchar(30) not null,
  bank_account_id uuid not null references public.bank_accounts (id) on delete restrict,
  created_by uuid references auth.users (id),
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_methods
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create unique index if not exists uq_payment_methods_name_lower
on public.payment_methods ((lower(name)));

create index if not exists idx_payment_methods_bank_account_id
on public.payment_methods (bank_account_id);

create index if not exists idx_payment_methods_created_at
on public.payment_methods (created_at desc);

create or replace function public.set_payment_methods_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_payment_methods_updated_at on public.payment_methods;
create trigger trg_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function public.set_payment_methods_updated_at();

-- Medio base vinculado a la cuenta efectivo.
with cash as (
  select id
  from public.bank_accounts
  where lower(name) = 'efectivo'
  limit 1
)
insert into public.payment_methods (name, bank_account_id, created_by)
select 'Efectivo', cash.id, null
from cash
where not exists (
  select 1
  from public.payment_methods
  where lower(name) = 'efectivo'
);

alter table public.bank_accounts enable row level security;
alter table public.payment_methods enable row level security;

-- Lectura: cualquier usuario autenticado y aprobado puede ver.
drop policy if exists "bank_accounts_select_approved" on public.bank_accounts;
create policy "bank_accounts_select_approved"
on public.bank_accounts
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

-- Escritura: solo owner/admin aprobados.
drop policy if exists "bank_accounts_insert_manager" on public.bank_accounts;
create policy "bank_accounts_insert_manager"
on public.bank_accounts
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

drop policy if exists "bank_accounts_update_manager" on public.bank_accounts;
create policy "bank_accounts_update_manager"
on public.bank_accounts
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

drop policy if exists "bank_accounts_delete_manager" on public.bank_accounts;
create policy "bank_accounts_delete_manager"
on public.bank_accounts
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

drop policy if exists "payment_methods_select_approved" on public.payment_methods;
create policy "payment_methods_select_approved"
on public.payment_methods
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

drop policy if exists "payment_methods_insert_manager" on public.payment_methods;
create policy "payment_methods_insert_manager"
on public.payment_methods
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

drop policy if exists "payment_methods_update_manager" on public.payment_methods;
create policy "payment_methods_update_manager"
on public.payment_methods
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

drop policy if exists "payment_methods_delete_manager" on public.payment_methods;
create policy "payment_methods_delete_manager"
on public.payment_methods
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
