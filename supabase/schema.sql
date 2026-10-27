-- Dindin: esquema do banco. Cole no Supabase em SQL Editor > New query > Run.
-- Cada linha pertence a quem esta logada (user_id = auth.uid()) e so ela consegue ler/escrever (RLS).

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
  icon text not null default 'card',
  color text not null default 'red',
  balance numeric(14,2) not null check (balance >= 0),
  balance_date date not null default current_date,
  interest_monthly numeric(7,3) not null default 0,
  min_payment numeric(14,2) not null default 0,
  due_day int check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.recurrings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'investment')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  day int not null check (day between 1 and 31),
  category_id uuid references public.categories(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  nature text check (nature in ('fixed', 'variable')),
  goal_id uuid references public.goals(id) on delete set null,
  active boolean not null default true,
  start_month text not null,
  end_month text,
  last_generated text,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense', 'investment')),
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  source_id uuid references public.sources(id) on delete set null,
  nature text check (nature in ('fixed', 'variable')),
  paid boolean not null default true,
  goal_id uuid references public.goals(id) on delete set null,
  debt_id uuid references public.debts(id) on delete set null,
  recurring_id uuid references public.recurrings(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, date);

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
  foreach t in array array['categories','sources','goals','debts','recurrings','transactions','budgets']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
