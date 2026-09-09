// Camada de acesso ao Supabase usada pelas funções serverless da Vercel.
// A service_role key só existe aqui (no servidor) — nunca vai para o navegador.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Chamada genérica à API REST (PostgREST) do Supabase.
export async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error(
      'Banco não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.'
    );
    err.status = 500;
    throw err;
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : null;

  if (!resp.ok) {
    const err = new Error(dados?.message || 'Erro ao acessar o banco de dados.');
    err.status = resp.status;
    err.detalhe = dados;
    throw err;
  }
  return dados;
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
