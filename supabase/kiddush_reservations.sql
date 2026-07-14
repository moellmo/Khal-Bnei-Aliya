create table if not exists public.kiddush_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  notification_email text not null default 'ybcuzz@gmail.com',
  zelle_email text not null default 'khalbneialiyah@gmail.com',
  headline text not null default 'Kiddush Reservations',
  message text,
  updated_at timestamptz not null default now()
);

insert into public.kiddush_settings (id)
values ('default')
on conflict (id) do nothing;

create table if not exists public.kiddush_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  default_quantity integer not null default 0 check (default_quantity >= 0),
  max_quantity integer check (max_quantity is null or max_quantity >= 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.kiddush_items
  (name, description, price, default_quantity, max_quantity, display_order)
values
  ('Cholent', 'Homemade', 25, 1, 1, 10),
  ('Potato Kugel', '9x13', 35, 1, 1, 20),
  ('Cake / Cookies', '~1 lb pkg', 10, 6, null, 30),
  ('Sauteed Liver', '6.5 oz', 10, 3, null, 40),
  ('Herring', '7 oz', 8, 2, null, 50),
  ('Cake Platters', '~2.5-3 lbs', 22, 0, null, 60)
on conflict do nothing;

create table if not exists public.kiddush_reservations (
  id uuid primary key default gen_random_uuid(),
  shabbos_date date not null,
  sponsor_name text not null,
  sponsor_email text not null,
  sponsor_phone text,
  sponsorship_text text not null,
  items jsonb not null default '[]'::jsonb,
  special_requests text,
  subtotal_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  payment_method text,
  payment_status text not null default 'pending',
  payment_reference text,
  charge_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists kiddush_reservations_one_open_per_date_idx
  on public.kiddush_reservations (shabbos_date)
  where payment_status in ('pending', 'paid', 'zelle_review', 'no_payment_due');

create index if not exists kiddush_reservations_date_idx
  on public.kiddush_reservations (shabbos_date);

create index if not exists kiddush_reservations_created_at_idx
  on public.kiddush_reservations (created_at desc);

create table if not exists public.hall_reservation_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  dates_needed text not null,
  details text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hall_reservation_requests_created_at_idx
  on public.hall_reservation_requests (created_at desc);
