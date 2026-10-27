-- Dindin v2: contas, cartoes, caixinhas, grupos, modelos, parcelamento, repeticao flexivel e dividas em etapas.
-- Roda no SQL Editor do Supabase sobre o banco da v1. E seguro repetir (usa IF NOT EXISTS) e preserva os dados.

-- ---------- novas tabelas
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'users',
  color text not null default 'blue',
  created_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'checking' check (kind in ('checking', 'savings', 'cash', 'benefit')),
  icon text not null default 'bank',
  color text not null default 'blue',
  initial_balance numeric(14,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'card',
  color text not null default 'purple',
  limit_amount numeric(14,2) not null default 0,
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  pay_account_id uuid references public.accounts(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'caixinha' check (kind in ('caixinha', 'fixed', 'stocks', 'crypto', 'other')),
  institution text not null default '',
  icon text not null default 'piggy',
  color text not null default 'purple',
  initial_balance numeric(14,2) not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense', 'investment')),
  description text not null default '',
  amount numeric(14,2),
  category_id uuid references public.categories(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  nature text check (nature in ('fixed', 'variable')),
  group_id uuid references public.groups(id) on delete set null,
  vault_id uuid references public.vaults(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- dividas: a negociar -> em pagamento -> quitada
alter table public.debts
  add column if not exists kind text not null default 'other' check (kind in ('bank', 'card', 'loan', 'personal', 'other')),
  add column if not exists status text not null default 'paying' check (status in ('open', 'paying', 'paid')),
  add column if not exists original_amount numeric(14,2),
  add column if not exists installments_total int,
  add column if not exists negotiated_at date,
  add column if not exists paid_at date,
  add column if not exists note text not null default '';
update public.debts set original_amount = balance where original_amount is null;
alter table public.debts alter column original_amount set default 0;
alter table public.debts alter column original_amount set not null;

-- ---------- fixos: repeticao flexivel
alter table public.recurrings
  add column if not exists variable boolean not null default false,
  add column if not exists frequency text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  add column if not exists interval_n int not null default 1 check (interval_n >= 1),
  add column if not exists start_date date,
  add column if not exists generated int not null default 0,
  add column if not exists count int check (count is null or count >= 1),
  add column if not exists end_date date,
  add column if not exists debt_id uuid references public.debts(id) on delete set null,
  add column if not exists group_id uuid references public.groups(id) on delete set null,
  add column if not exists vault_id uuid references public.vaults(id) on delete set null,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists card_id uuid references public.cards(id) on delete set null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists note text not null default '';

-- converte o formato antigo (mes + dia) e remove as colunas velhas
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'recurrings' and column_name = 'start_month') then
    update public.recurrings r set
      start_date = make_date(
        split_part(r.start_month, '-', 1)::int, split_part(r.start_month, '-', 2)::int,
        least(r.day, extract(day from (make_date(split_part(r.start_month, '-', 1)::int, split_part(r.start_month, '-', 2)::int, 1) + interval '1 month' - interval '1 day'))::int)
      ),
      generated = (select count(*) from public.transactions t where t.recurring_id = r.id)
    where r.start_date is null;
    alter table public.recurrings drop column start_month, drop column end_month, drop column last_generated, drop column day;
  end if;
end $$;
update public.recurrings set start_date = current_date where start_date is null;
alter table public.recurrings alter column start_date set not null;

-- ---------- lancamentos: conta, cartao, caixinha, grupo, tags, parcelas, transferencias
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions drop constraint if exists transactions_amount_check;
alter table public.transactions
  add column if not exists group_id uuid references public.groups(id) on delete set null,
  add column if not exists vault_id uuid references public.vaults(id) on delete set null,
  add column if not exists account_id uuid references public.accounts(id) on delete set null,
  add column if not exists to_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists card_id uuid references public.cards(id) on delete set null,
  add column if not exists invoice_month text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists note text not null default '',
  add column if not exists installment_group uuid,
  add column if not exists installment_no int,
  add column if not exists installment_total int;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('income', 'expense', 'investment', 'transfer', 'redeem', 'yield'));
-- rendimento pode ser negativo (perda); os demais, sempre positivo
alter table public.transactions add constraint transactions_amount_check
  check ((kind = 'yield' and amount <> 0) or amount > 0);
create index if not exists transactions_card_idx on public.transactions (user_id, card_id) where card_id is not null;
create index if not exists transactions_vault_idx on public.transactions (user_id, vault_id) where vault_id is not null;
create index if not exists transactions_installment_idx on public.transactions (installment_group) where installment_group is not null;

-- ---------- seguranca: so a dona da linha enxerga e altera
do $$
declare t text;
begin
  foreach t in array array['groups','accounts','cards','vaults','templates','categories','sources','goals','debts','recurrings','transactions','budgets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
