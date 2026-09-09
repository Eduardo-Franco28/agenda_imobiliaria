-- ============================================================
-- Agenda Imobiliária — schema do banco (Supabase / Postgres)
-- Já aplicado no projeto 'agenda-imobiliaria' (ref yuojxbeakhfnlvefzoro)
-- como a migration 'create_manutencoes_table'.
-- Mantido aqui como histórico / para recriar o banco do zero:
-- Supabase > SQL Editor > New query > Run
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

-- ------------------------------------------------------------
-- Segurança: RLS ligado e SEM nenhuma policy.
-- Ninguém acessa a tabela pela API pública do Supabase (chave anon).
-- Só a service_role key — usada apenas nas funções /api da Vercel,
-- que nunca chega ao navegador — consegue ler e escrever.
-- ------------------------------------------------------------
alter table public.manutencoes enable row level security;
