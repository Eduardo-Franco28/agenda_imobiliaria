-- ============================================================
-- Agenda Imobiliária — schema do banco (Postgres no Neon)
-- Aplicado no Neon (migrado do Supabase em 2026-10-20).
-- Para recriar o banco do zero: Neon > SQL Editor > cole este arquivo > Run
-- ============================================================

create table if not exists public.manutencoes (
  id               uuid primary key default gen_random_uuid(),
  contract_code    text        not null default '',
  property_address text        not null default '',
  tenant_name      text        not null default '',
  tenant_contact   text        not null default '',
  provider_name    text        not null default '',
  provider_contact text        not null default '',
  schedule_date    date        not null,
  schedule_time    text        not null default '',
  status           text        not null default 'Pendente',
  manager_name     text        not null default '',
  criticality      text        not null default 'Necessário',
  service_type     text        not null default '',
  service_notes    text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Consultas do calendário sempre filtram/ordenam por data.
create index if not exists manutencoes_schedule_date_idx
  on public.manutencoes (schedule_date);

-- Atualiza updated_at automaticamente em cada UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manutencoes_set_updated_at on public.manutencoes;
create trigger manutencoes_set_updated_at
  before update on public.manutencoes
  for each row execute function public.set_updated_at();

