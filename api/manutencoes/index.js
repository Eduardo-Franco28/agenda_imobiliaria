// GET  /api/manutencoes  -> lista todos os agendamentos
// POST /api/manutencoes  -> cria um agendamento
import { supabase, TABLE, toRow, toEvent, validate, handle } from '../_supabase.js';

export default handle(async (req, res) => {
  if (req.method === 'GET') {
    const linhas = await supabase(
      `${TABLE}?select=*&order=schedule_date.asc,schedule_time.asc`
    );
    return res.status(200).json(linhas.map(toEvent));
  }

  if (req.method === 'POST') {
    const row = toRow(req.body || {});
    const erro = validate(row);
    if (erro) return res.status(400).json({ erro });

    const [criado] = await supabase(TABLE, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    return res.status(201).json(toEvent(criado));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ erro: 'Método não permitido.' });
});
