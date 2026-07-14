create table if not exists public.accounting_expenses (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category text,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  note text,
  receipt_url text,
  status text not null default 'recorded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zelle_payments (
  id uuid primary key default gen_random_uuid(),
  payer_name text not null,
  payer_email text,
  amount numeric(12, 2) not null check (amount > 0),
  received_date date not null,
  purpose text,
  note text,
  status text not null default 'unmatched',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  vendor text not null,
  category text,
  amount numeric(12, 2) not null check (amount > 0),
  frequency text not null default 'monthly'
    check (frequency in ('monthly', 'weekly')),
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  day_of_week integer not null default 0 check (day_of_week between 0 and 6),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounting_bank_snapshots (
  id uuid primary key default gen_random_uuid(),
  balance numeric(12, 2) not null,
  snapshot_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists accounting_bank_snapshots_snapshot_date_idx
  on public.accounting_bank_snapshots(snapshot_date desc);

alter table public.accounting_expenses
  add column if not exists recurring_template_id uuid
  references public.accounting_recurring_expenses(id)
  on delete set null;

create index if not exists accounting_expenses_recurring_template_id_idx
  on public.accounting_expenses(recurring_template_id);

alter table public.accounting_recurring_expenses
  add column if not exists frequency text not null default 'monthly'
  check (frequency in ('monthly', 'weekly'));

alter table public.accounting_recurring_expenses
  add column if not exists day_of_week integer not null default 0
  check (day_of_week between 0 and 6);

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('accounting-receipts', 'accounting-receipts', false)
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.member_charges'::regclass
      and conname = 'member_charges_amount_check'
  ) then
    alter table public.member_charges
      drop constraint member_charges_amount_check;
  end if;
end $$;

alter table public.member_charges
  drop constraint if exists member_charges_amount_nonnegative;

alter table public.member_charges
  add constraint member_charges_amount_nonnegative
  check (amount >= 0);
