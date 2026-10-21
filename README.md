# Agenda de Manutenções — D.LANGE Imóveis

Agenda de ordens de serviço (calendário + tabela) com os dados guardados em um
**banco de dados Postgres**, não mais no `localStorage` do navegador.

## Como está montado

```
index.html                     site estático (calendário, tabela, modais)
api/manutencoes/index.js       GET (listar) e POST (criar)
api/manutencoes/[id].js        PUT (editar) e DELETE (excluir)
api/_db.js                     acesso ao banco + conversão de campos
db/schema.sql                  criação da tabela
```

O navegador **nunca** fala com o banco diretamente: ele chama `/api/manutencoes`,
que roda como função serverless na própria Vercel (incluída no plano gratuito, no
mesmo deploy do site). A chave secreta do banco fica só na variável de ambiente do
servidor. Você não hospeda nem servidor nem banco — o Neon entrega o Postgres
gerenciado no plano gratuito.

---

## Configuração

O banco é um Postgres **gerenciado pelo [Neon](https://neon.tech)** (plano
gratuito, região São Paulo), compartilhado pelos sistemas da D.Lange — cada um
com a sua tabela. A deste sistema é `public.manutencoes`, criada pelo SQL em
[`db/schema.sql`](db/schema.sql).

No plano gratuito o Neon desliga o banco depois de alguns minutos sem uso e o
religa sozinho na próxima consulta: a primeira requisição depois de um tempo
parado demora um pouco mais, mas ninguém precisa reativar nada.

Na Vercel, a única variável de ambiente é:

| Name | Value |
|---|---|
| `DATABASE_URL` | connection string do Neon (a com `-pooler`), em Neon → **Connect** |

Variável nova só vale depois de um **Redeploy**. Sem ela o app abre com uma barra
vermelha avisando que o banco não está configurado.

> Até outubro de 2026 os dados ficavam no Supabase, que pausava o projeto depois
> de 7 dias sem uso.

## Migrar os agendamentos que estavam no navegador

Se você já usava a versão antiga nesta máquina, abra a nova URL **no mesmo
navegador**: estando o banco vazio, a aplicação detecta os registros do
`localStorage` e pergunta se deve enviá-los para o banco. Aceite; depois disso
os dados passam a ser compartilhados entre todos os computadores.

---

## Rodar localmente

```bash
npm i -g vercel
cp .env.example .env.local   # preencha a DATABASE_URL do Neon
vercel dev
```

Abrir o `index.html` com duplo clique **não funciona**: sem o `vercel dev` as
rotas `/api/...` não existem e a agenda mostra o aviso de falha de conexão.

---

## API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/manutencoes` | Lista todos os agendamentos (ordenados por data/hora) |
| `POST` | `/api/manutencoes` | Cria um agendamento |
| `PUT` | `/api/manutencoes/:id` | Substitui os dados de um agendamento |
| `DELETE` | `/api/manutencoes/:id` | Exclui um agendamento |

Corpo de `POST`/`PUT` (JSON):

```json
{
  "contractCode": "CTR-2041",
  "propertyAddress": "Av. Paulista, 1000 - Apto 12B",
  "tenantName": "Lucas Silveira",
  "tenantContact": "(11) 97788-1122",
  "providerName": "Electro Service Ltda",
  "providerContact": "(11) 94433-2211",
  "scheduleDate": "2026-09-09",
  "scheduleTime": "14:30",
  "status": "Pendente",
  "managerName": "Gestora Contratos 1",
  "criticality": "Emergencial",
  "serviceType": "Reparo no Quadro Elétrico",
  "serviceNotes": "Disjuntor desarmando com faíscas."
}
```

---

## Segurança

A `DATABASE_URL` só existe nas variáveis de ambiente da Vercel: o navegador
nunca fala com o banco. Já as rotas `/api` ainda **não têm login** — quem tiver
a URL do site vê e altera a agenda. Para fechar, adicione um login (por exemplo
o Neon Auth / Better Auth) e valide a sessão no início de cada função `/api`.
