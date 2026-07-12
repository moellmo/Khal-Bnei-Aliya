create table if not exists public.yamim_noraim_settings (
  id text primary key default 'default',
  enabled boolean not null default false,
  active_year integer not null default extract(year from now())::integer,
  men_seat_price numeric(12, 2) not null default 100,
  women_seat_price numeric(12, 2) not null default 100,
  headline text not null default 'Yamim Noraim Seat Reservations',
  message text,
  updated_at timestamptz not null default now()
);

insert into public.yamim_noraim_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.yamim_noraim_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_year integer not null,
  full_name text not null,
  email text,
  phone text,
  member_name text,
  men_seats integer not null default 0 check (men_seats >= 0),
  women_seats integer not null default 0 check (women_seats >= 0),
  men_seat_price numeric(12, 2) not null default 0,
  women_seat_price numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  payment_status text not null default 'pending',
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.yamim_noraim_reservations
  add column if not exists rosh_hashana_men_seats integer not null default 0 check (rosh_hashana_men_seats >= 0),
  add column if not exists rosh_hashana_women_seats integer not null default 0 check (rosh_hashana_women_seats >= 0),
  add column if not exists yom_kippur_men_seats integer not null default 0 check (yom_kippur_men_seats >= 0),
  add column if not exists yom_kippur_women_seats integer not null default 0 check (yom_kippur_women_seats >= 0);

create index if not exists yamim_noraim_reservations_year_idx
  on public.yamim_noraim_reservations (reservation_year);

create index if not exists yamim_noraim_reservations_created_at_idx
  on public.yamim_noraim_reservations (created_at desc);
