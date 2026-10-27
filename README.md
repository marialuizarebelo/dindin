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
1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito serve; região *South America (São Paulo)*).
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

## Aparência
- **3 paletas** (Ajustes → Aparência): *Musgo* (padrão), *Lilás* e *Névoa*. Cada uma define fundo, tinta, menu lateral e cor de destaque; as cores das categorias são comuns.
- **Modo noturno / diurno** e **ocultar valores** ficam no menu lateral (no celular, na pílula do topo). Ocultar troca *todo* valor em reais por `••••` (textos, gráficos, dicas e avisos). Janelas de edição mostram o valor, porque é preciso editá-lo.
- **Tipografia:** títulos e números grandes em *AV Estiana*; o resto em sans do sistema (San Francisco no iPhone) com Inter de reserva.

> **Licença da fonte:** a AV Estiana veio com licença *Desktop Commercial* (uso pessoal e comercial, **não vale para logotipo**; uso na web não é citado). Por isso o logo “dindin” usa a sans. Se o app for compartilhado com outras pessoas, peça licença web ao autor (`altvieroffice@gmail.com`). Mantenha este repositório **privado** enquanto a fonte estiver em `public/fonts/`.

## Segurança
- Login por e-mail/senha (Supabase Auth), sessão renovada automaticamente.
- Todas as tabelas com RLS: `user_id = auth.uid()`; o papel `anon` não tem acesso.
- Cadastro público desativado (passo 1.4). `VITE_ALLOW_SIGNUP` deve ficar `false`.
- Cabeçalhos `noindex`, `X-Frame-Options: DENY` etc. em `vercel.json`.
- “Modo discreto” (olho no topo) borra os valores quando você está em público.
- Backup: *Ajustes → Backup completo (JSON)* e *Exportar planilha (CSV)*.

## Como funciona
- **Lançamento rápido:** receita, despesa, transferência ou caixinha. O valor aceita conta (`12,50+30`). Escolha **conta ou cartão**, **grupo** (Casa, Minhas, Lucas, Mãe…), data com atalhos, tags e observação. Os **modelos** de 1 toque ficam no topo.
- **Parcelado ou fixo:** *Parcelada* divide a compra (valor total ou da parcela, até parcelas de valores diferentes) e cada parcela cai na fatura certa. *Fixa* repete por dia, semana, mês ou ano, a cada N, para sempre, N vezes ou até uma data, com opção de **valor estimado** (luz, água). Ao editar ou apagar, escolha *só esta*, *esta e as próximas* ou *todas*.
- **Contas e cartões:** conta corrente, poupança, carteira e **vale/benefício** (ex.: iFood), cada uma com saldo. Cartões (o seu e de outras pessoas) com limite, fechamento, vencimento, **fatura** por mês e botão de pagar. Compras a partir do dia de fechamento entram na fatura seguinte.
- **Caixinhas:** várias, com **aporte, resgate e rendimento**, total investido, rendimento (R$ e %) e evolução. *Atualizar pelo saldo do app do banco* registra a diferença como rendimento.
- **Dívidas em 3 etapas:** *a negociar* → *em pagamento* → *quitada* (histórico). *Negociar* cria as parcelas (ou um pagamento mensal até quitar) na agenda. O empréstimo de familiar entra como dívida em pagamento, sem juros.
- **Agenda:** calendário de vencimentos e recebimentos e **previsão de saldo** de 30/60/90 dias, com aviso se o saldo for ficar negativo.
- **Início:** leituras em linguagem simples, contas, cartões, caixinhas, quanto já está comprometido nos próximos meses e gastos por grupo.
- **Metas:** o progresso soma o “já tenho” + os aportes ligados à meta.
- **Planilha:** categorias × dias/meses; clique numa célula para ver os lançamentos.

## Atualizando um banco que já existe
Se você instalou a versão anterior, rode **`supabase/migrations/002_contas_cartoes_caixinhas.sql`** no SQL Editor (preserva os dados e pode ser repetido). Para instalação do zero, use `supabase/schema.sql`.

## Scripts
`npm run dev` · `npm run build` · `npm test` (período, calculadora, parcelas, repetição, fatura, saldo, caixinhas, previsão e dívidas)

## Próximos passos possíveis
Importar extrato (OFX/CSV) com categorização automática · relatórios comparativos mês a mês ·
detecção de assinaturas esquecidas · lembretes de vencimento · reembolsos entre pessoas.
