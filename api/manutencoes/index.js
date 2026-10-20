// GET  /api/manutencoes  -> lista todos os agendamentos
// POST /api/manutencoes  -> cria um agendamento
import { listar, inserir, toRow, toEvent, validate, handle } from '../_db.js';

export default handle(async (req, res) => {
  if (req.method === 'GET') {
    const linhas = await listar('schedule_date asc, schedule_time asc');
    return res.status(200).json(linhas.map(toEvent));
  }

  if (req.method === 'POST') {
    const row = toRow(req.body || {});
    const erro = validate(row);
    if (erro) return res.status(400).json({ erro });

    const criado = await inserir(row);
    return res.status(201).json(toEvent(criado));
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ erro: 'Método não permitido.' });
});
