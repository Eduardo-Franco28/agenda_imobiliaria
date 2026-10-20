// PUT    /api/manutencoes/:id -> atualiza um agendamento
// DELETE /api/manutencoes/:id -> remove um agendamento
import { atualizar, remover, toRow, toEvent, validate, isUuid, handle } from '../_db.js';

export default handle(async (req, res) => {
  const { id } = req.query;
  if (!isUuid(id)) return res.status(400).json({ erro: 'ID inválido.' });

  if (req.method === 'PUT' || req.method === 'PATCH') {
    const row = toRow(req.body || {});
    const erro = validate(row, { partial: req.method === 'PATCH' });
    if (erro) return res.status(400).json({ erro });

    const atualizado = await atualizar(id, row);
    if (!atualizado) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    return res.status(200).json(toEvent(atualizado));
  }

  if (req.method === 'DELETE') {
    if (!(await remover(id))) return res.status(404).json({ erro: 'Agendamento não encontrado.' });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PUT, PATCH, DELETE');
  return res.status(405).json({ erro: 'Método não permitido.' });
});
