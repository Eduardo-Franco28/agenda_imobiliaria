// Camada de acesso ao Postgres (Neon) usada pelas funcoes serverless da Vercel.
// A DATABASE_URL so existe aqui (no servidor) — nunca vai para o navegador.
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

const TABLE = 'manutencoes';

// Colunas do banco (snake_case) <-> campos usados no front (camelCase).
const FIELDS = {
  contractCode: 'contract_code',
  propertyAddress: 'property_address',
  tenantName: 'tenant_name',
  tenantContact: 'tenant_contact',
  providerName: 'provider_name',
  providerContact: 'provider_contact',
  scheduleDate: 'schedule_date',
  scheduleTime: 'schedule_time',
  status: 'status',
  managerName: 'manager_name',
  criticality: 'criticality',
  serviceType: 'service_type',
  serviceNotes: 'service_notes'
};

export function toRow(body) {
  const row = {};
  for (const [campo, coluna] of Object.entries(FIELDS)) {
    if (body[campo] !== undefined && body[campo] !== null) {
      row[coluna] = String(body[campo]);
    }
  }
  return row;
}

export function toEvent(row) {
  const ev = { id: row.id };
  for (const [campo, coluna] of Object.entries(FIELDS)) {
    ev[campo] = row[coluna] ?? '';
  }
  return ev;
}

export function validate(row, { partial = false } = {}) {
  if (!partial && !row.schedule_date) return 'A data do agendamento é obrigatória.';
  if (row.schedule_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.schedule_date)) {
    return 'Data inválida (use AAAA-MM-DD).';
  }
  if (row.schedule_time && !/^\d{2}:\d{2}$/.test(row.schedule_time)) {
    return 'Horário inválido (use HH:MM).';
  }
  if (Object.keys(row).length === 0) return 'Nenhum campo válido enviado.';
  return null;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

let sql;

// Executa um SQL parametrizado no Neon (driver HTTP, ideal para serverless).
export async function query(texto, params = []) {
  if (!DATABASE_URL) {
    const err = new Error('Banco não configurado: defina DATABASE_URL nas variáveis de ambiente.');
    err.status = 500;
    throw err;
  }
  sql ??= neon(DATABASE_URL);
  try {
    return await sql.query(texto, params);
  } catch (erro) {
    // 23505 = chave duplicada; classes 22/23 = dado invalido ou restricao violada.
    if (erro.code === '23505') erro.status = 409;
    else if (/^2[23]/.test(erro.code || '')) erro.status = 400;
    throw erro;
  }
}

// Cada linha volta como jsonb: datas chegam como 'AAAA-MM-DD' e timestamps em
// ISO, no mesmo formato que a API REST do Supabase devolvia.
const LINHA = 'to_jsonb(t) as r';

// jsonb vai como texto JSON — senao o driver converteria listas em array do Postgres.
function valor(v) {
  return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}

export async function listar(ordem) {
  const linhas = await query(`select ${LINHA} from ${TABLE} t order by ${ordem}`);
  return linhas.map((l) => l.r);
}

export async function inserir(row) {
  const colunas = Object.keys(row);
  const linhas = await query(
    `insert into ${TABLE} as t (${colunas.join(', ')})
     values (${colunas.map((_, i) => '$' + (i + 1)).join(', ')})
     returning ${LINHA}`,
    colunas.map((c) => valor(row[c]))
  );
  return linhas[0].r;
}

// Devolve a linha atualizada, ou null se o id nao existir.
export async function atualizar(id, row) {
  const colunas = Object.keys(row);
  const linhas = await query(
    `update ${TABLE} as t set ${colunas.map((c, i) => c + ' = $' + (i + 2)).join(', ')}
     where id = $1 returning ${LINHA}`,
    [id, ...colunas.map((c) => valor(row[c]))]
  );
  return linhas[0]?.r ?? null;
}

// Devolve true se removeu, false se o id nao existir.
export async function remover(id) {
  const linhas = await query(`delete from ${TABLE} where id = $1 returning id`, [id]);
  return linhas.length > 0;
}

export { TABLE };

// Envolve o handler com tratamento de erro e cache desligado
// (a agenda precisa sempre da versão mais recente).
export function handle(fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await fn(req, res);
    } catch (erro) {
      console.error(erro);
      res.status(erro.status || 500).json({ erro: erro.message || 'Erro inesperado.' });
    }
  };
}
