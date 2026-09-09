// PUT    /api/manutencoes/:id -> atualiza um agendamento
// DELETE /api/manutencoes/:id -> remove um agendamento
import { supabase, TABLE, toRow, toEvent, validate, isUuid, handle } from '../_supabase.js';

export default handle(async (req, res) => {
  const { id } = req.query;
  if (!isUuid(id)) return res.status(400).json({ erro: 'ID inválido.' });

  const filtro = `${TABLE}?id=eq.${id}`;

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const row = toRow(req.body || {});
    const erro = validate(row, { partial: req.method === 'PATCH' });
    if (erro) return res.status(400).json({ erro });

    const atualizados = await supabase(filtro, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    if (!atualizados.length) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    return res.status(200).json(toEvent(atualizados[0]));
  }

  if (req.method === 'DELETE') {
    const removidos = await supabase(filtro, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' }
    });
    if (!removidos.length) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, PATCH, DELETE');
  return res.status(405).json({ erro: 'Método não permitido.' });
});
