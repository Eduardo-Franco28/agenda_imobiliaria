// POST /api/migrar-neon?token=... -> ROTA TEMPORARIA da migracao Supabase -> Neon.
// Cria as 5 tabelas dos sistemas no Neon e copia as linhas do Supabase.
// Pode rodar mais de uma vez: linhas que ja existem no Neon sao ignoradas.
// Remover depois que a migracao for conferida.
import { createHash } from 'node:crypto';
import { query, handle } from './_db.js';

// Guarda so o hash: o token em si nao fica no repositorio.
const TOKEN_SHA256 = '45f7b6f1ea339ed1e2ee8265dde9fac1309f25a956ca1210f09ccfb2c647c075';

const SCHEMA = [
  `create or replace function public.set_updated_at()
   returns trigger language plpgsql set search_path = '' as $$
   begin
     new.updated_at = now();
     return new;
   end;
   $$`,

  `create table if not exists public.manutencoes (
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
   )`,
  `create index if not exists manutencoes_schedule_date_idx on public.manutencoes (schedule_date)`,

  `create table if not exists public.previsoes_desocupacao (
     id                       uuid primary key default gen_random_uuid(),
     contract_number          text        not null default '',
     tenant_name              text        not null default '',
     owner_name               text        not null default '',
     guarantee_type           text        not null default '',
     notice_date              date,
     forecast_date            date,
     manager_name             text        not null default '',
     status                   text        not null default 'pendente'
                              check (status in ('pendente', 'concluido')),
     inspection_schedule_date date,
     completed_date           date,
     checks                   jsonb       not null default '{}'::jsonb,
     conformity               jsonb       not null default '{}'::jsonb,
     created_at               timestamptz not null default now(),
     updated_at               timestamptz not null default now()
   )`,
  `create index if not exists previsoes_desocupacao_forecast_date_idx on public.previsoes_desocupacao (forecast_date)`,

  `create table if not exists public.checklists_contratos (
     id                uuid primary key default gen_random_uuid(),
     contract_num      text        not null default '',
     imovel            text        not null default '',
     analista          text        not null default '',
     gestor            text        not null default '',
     mes               text        not null default ''
                       check (mes = '' or mes ~ '^\\d{4}-\\d{2}$'),
     analyst_notes     text        not null default '',
     analyst_checklist jsonb       not null default '[]'::jsonb,
     erp_checklist     jsonb       not null default '[]'::jsonb,
     senior_checklist  jsonb       not null default '[]'::jsonb,
     val_direct        jsonb       not null default '{"status":"Pendente","notes":""}'::jsonb,
     val_final         jsonb       not null default '{"status":"Pendente","notes":""}'::jsonb,
     created_at        timestamptz not null default now(),
     updated_at        timestamptz not null default now()
   )`,
  `create index if not exists checklists_contratos_mes_idx on public.checklists_contratos (mes)`,

  `create table if not exists public.checklists_rescisao (
     id               text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
     contrato_numero  text        not null default '',
     endereco         text        not null default '',
     status_processo  text        not null default '',
     dados            jsonb       not null default '{}'::jsonb
                      check (jsonb_typeof(dados) = 'object'),
     created_at       timestamptz not null default now(),
     updated_at       timestamptz not null default now()
   )`,
  `create index if not exists checklists_rescisao_status_idx on public.checklists_rescisao (status_processo)`,

  `create table if not exists public.processos_juridicos (
     id                     uuid primary key default gen_random_uuid(),
     contract_number        text        not null default '',
     admin_process_number   text        not null default '',
     process_category       text        not null default 'cobranca_aluguel',
     tenant_name            text        not null default '',
     send_date              date,
     acceptance_date        date,
     negotiation_start_date date,
     landlord_notified_date date,
     general_status         text        not null default 'Pendente de Aceite',
     doc_request_status     text        not null default 'Pendente',
     lawsuit_protocol_date  date,
     has_agreement          boolean     not null default false,
     agreement_date         date,
     agreement_details      text        not null default '',
     agreement_installments text        not null default '',
     observations           text        not null default '',
     created_at             timestamptz not null default now(),
     updated_at             timestamptz not null default now()
   )`,
  `create index if not exists processos_juridicos_created_at_idx on public.processos_juridicos (created_at desc)`
];

const TABELAS = [
  'manutencoes',
  'previsoes_desocupacao',
  'checklists_contratos',
  'checklists_rescisao',
  'processos_juridicos'
];

async function lerSupabase(tabela) {
  const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${tabela}?select=*`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  if (!resp.ok) throw new Error(`Supabase ${tabela}: HTTP ${resp.status} ${await resp.text()}`);
  return resp.json();
}

export default handle(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });
  const hash = createHash('sha256').update(String(req.query.token || '')).digest('hex');
  if (hash !== TOKEN_SHA256) return res.status(403).json({ erro: 'Token inválido.' });

  for (const comando of SCHEMA) await query(comando);
  for (const tabela of TABELAS) {
    await query(`drop trigger if exists ${tabela}_set_updated_at on public.${tabela}`);
    await query(
      `create trigger ${tabela}_set_updated_at before update on public.${tabela}
       for each row execute function public.set_updated_at()`
    );
  }

  const resultado = {};
  for (const tabela of TABELAS) {
    const linhas = await lerSupabase(tabela);
    const inseridas = linhas.length
      ? await query(
          `insert into public.${tabela}
           select * from jsonb_populate_recordset(null::public.${tabela}, $1::jsonb)
           on conflict (id) do nothing
           returning id`,
          [JSON.stringify(linhas)]
        )
      : [];
    const [{ total }] = await query(`select count(*)::int as total from public.${tabela}`);
    resultado[tabela] = { supabase: linhas.length, inseridas: inseridas.length, neon: total };
  }

  return res.status(200).json(resultado);
});
