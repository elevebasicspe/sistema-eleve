-- Ejecutar en Supabase SQL Editor.
-- Script idempotente para tabla de perfiles y seguridad base.

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role' and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('owner', 'admin', 'vendedor', 'contador');
  end if;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role public.app_role not null default 'vendedor',
  is_approved boolean not null default false,
  created_by_app text not null default 'OMNI AGENCIA S.A.C.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists created_by_app text not null default 'OMNI AGENCIA S.A.C.';

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

create index if not exists idx_profiles_role_approved
on public.profiles(role, is_approved);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Owner inicial (una sola vez, manual):
-- update public.profiles set role = 'owner', is_approved = true where email = 'tu_correo@empresa.com';
