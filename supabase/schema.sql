-- Dindin: esquema completo (v2). Cole no Supabase em SQL Editor > New query > Run (instalacao do zero).
-- Se voce ja tem a v1 instalada, rode supabase/migrations/002_contas_cartoes_caixinhas.sql em vez deste arquivo.
-- Cada linha pertence a quem esta logada (user_id = auth.uid()) e so ela consegue ler/escrever (RLS).

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

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'investment')),
  icon text not null default 'sparkles',
  color text not null default 'gray',
  created_at timestamptz not null default now()
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'briefcase',
  color text not null default 'green',
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'target',
  color text not null default 'blue',
  target numeric(14,2) not null check (target > 0),
  initial numeric(14,2) not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  creditor text not null default '',
  kind text not null default 'other' check (kind in ('bank', 'card', 'loan', 'personal', 'other')),
  status text not null default 'open' check (status in ('open', 'paying', 'paid')),
  icon text not null default 'card',
  color text not null default 'red',
  original_amount numeric(14,2) not null default 0,
  balance numeric(14,2) not null check (balance >= 0),
  balance_date date not null default current_date,
  interest_monthly numeric(7,3) not null default 0,
  min_payment numeric(14,2) not null default 0,
  due_day int check (due_day between 1 and 31),
  installments_total int,
  negotiated_at date,
  paid_at date,
  note text not null default '',
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

create table if not exists public.recurrings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'investment')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  variable boolean not null default false,
  frequency text not null default 'monthly' check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  interval_n int not null default 1 check (interval_n >= 1),
  start_date date not null,
  generated int not null default 0,
  count int check (count is null or count >= 1),
  end_date date,
  category_id uuid references public.categories(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  nature text check (nature in ('fixed', 'variable')),
  goal_id uuid references public.goals(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  vault_id uuid references public.vaults(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  tags text[] not null default '{}',
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'investment', 'transfer', 'redeem', 'yield')),
  date date not null,
  amount numeric(14,2) not null,
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  nature text check (nature in ('fixed', 'variable')),
  paid boolean not null default true,
  goal_id uuid references public.goals(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  recurring_id uuid references public.recurrings(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  vault_id uuid references public.vaults(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  card_id uuid references public.cards(id) on delete set null,
  invoice_month text,
  tags text[] not null default '{}',
  note text not null default '',
  installment_group uuid,
  installment_no int,
  installment_total int,
  created_at timestamptz not null default now(),
  -- rendimento pode ser negativo (perda); os demais, sempre positivo
  constraint transactions_amount_check check ((kind = 'yield' and amount <> 0) or amount > 0)
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);
create index if not exists transactions_card_idx on public.transactions (user_id, card_id) where card_id is not null;
create index if not exists transactions_vault_idx on public.transactions (user_id, vault_id) where vault_id is not null;
create index if not exists transactions_installment_idx on public.transactions (installment_group) where installment_group is not null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- Seguranca: so a dona da linha enxerga e altera.
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
