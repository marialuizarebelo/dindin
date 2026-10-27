# dindin

Controle financeiro pessoal: receitas por origem, despesas fixas e variáveis, investimentos, metas,
dívidas (com simulador de quitação), planejamento e uma visão de planilha. Funciona no celular e no
computador, com login.

**Stack:** Vite + React + TypeScript + Tailwind · Supabase (login e banco) · Vercel (hospedagem).
Não há servidor próprio: o navegador fala direto com o Supabase, e o banco só entrega as linhas
de quem está logada (RLS).

## Rodar localmente (modo demonstração)

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o app abre em **modo demonstração**: sem login, dados só no navegador.
Em *Ajustes* há um botão para carregar dados de exemplo.

## Colocar no ar com login (≈15 min)

### 1. Supabase (banco + login)
1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito serve).
2. **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e rode.
3. **Authentication → Users → Add user**: crie o seu usuário (e-mail + senha com 8+ caracteres).
4. **Authentication → Sign In / Providers → Email**: desative **“Allow new users to sign up”**.
   Assim ninguém além de você consegue criar conta.
5. **Project Settings → API**: copie a *Project URL* e a chave *anon public*.

### 2. Vercel (hospedagem)
1. Importe este repositório em [vercel.com/new](https://vercel.com/new) (Framework: Vite, já detectado).
2. Em *Environment Variables* adicione:
   - `VITE_SUPABASE_URL` = a Project URL
   - `VITE_SUPABASE_ANON_KEY` = a chave anon
3. Deploy. Abra o link, entre com seu usuário.

> A chave *anon* é pública por desenho; quem protege seus dados é o login + as regras RLS do
> `schema.sql`. **Nunca** coloque a chave `service_role` no app.

### 3. Domínio (opcional, Hostinger)
Na Vercel: *Settings → Domains*. No Hostinger, aponte o DNS como a Vercel indicar (CNAME/A).

### 4. Instalar no celular
Abra o site no Safari (iPhone) ou Chrome (Android) → *Adicionar à tela de início*.

## Segurança
- Login por e-mail/senha (Supabase Auth), sessão renovada automaticamente.
- Todas as tabelas com RLS: `user_id = auth.uid()`; o papel `anon` não tem acesso.
- Cadastro público desativado (passo 1.4). `VITE_ALLOW_SIGNUP` deve ficar `false`.
- Cabeçalhos `noindex`, `X-Frame-Options: DENY` etc. em `vercel.json`.
- “Modo discreto” (olho no topo) borra os valores quando você está em público.
- Backup: *Ajustes → Backup completo (JSON)* e *Exportar planilha (CSV)*.

## Como funciona
- **Lançamento:** receita (com *origem*), despesa (*fixa* ou *variável*, com categoria) ou investimento
  (opcionalmente ligado a uma meta). Data futura vira *pendente* até você marcar como pago.
- **Fixos que se repetem** (Planejamento): cadastre uma vez; o app lança o mês atual e o próximo.
  Se você apagar um lançamento gerado, ele não volta.
- **Metas:** o progresso soma o “já tenho” + os aportes ligados à meta.
- **Dívidas:** saldo = saldo informado − pagamentos registrados desde a data do saldo. Quando o banco
  informar um novo saldo (com juros), use *Editar* e atualize. O simulador compara
  *maior juros primeiro* × *menor saldo primeiro*.
- **Planilha:** categorias × dias/meses; clique numa célula para ver os lançamentos.
- **“Como você está este mês”:** leituras calculadas (sem IA) sobre ritmo de gastos, projeção do mês
  e quanto dá pra gastar por dia.

## Scripts
`npm run dev` · `npm run build` · `npm test` (período, parser de valores e simulador de dívidas)

## Próximos passos possíveis
Cartão de crédito com fatura e fechamento · importar extrato (OFX/CSV) · lançar por mensagem ·
detecção de assinaturas esquecidas · orçamento por envelopes.
