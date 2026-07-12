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

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
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
