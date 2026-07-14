create table if not exists public.kiddush_settings (
  id text primary key default 'default',
  enabled boolean not null default true,
  notification_email text not null default 'ybcuzz@gmail.com',
  zelle_email text not null default 'khalbneialiyah@gmail.com',
  weeks_to_show integer not null default 26 check (weeks_to_show between 1 and 104),
  base_fee_amount numeric(12, 2) not null default 49,
  minimum_total_amount numeric(12, 2) not null default 215,
  headline text not null default 'Kiddush Reservations',
  message text,
  updated_at timestamptz not null default now()
);

alter table public.kiddush_settings
  add column if not exists weeks_to_show integer not null default 26 check (weeks_to_show between 1 and 104),
  add column if not exists base_fee_amount numeric(12, 2) not null default 49,
  add column if not exists minimum_total_amount numeric(12, 2) not null default 215;

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

with ranked_kiddush_items as (
  select
    id,
    row_number() over (
      partition by lower(name)
      order by created_at asc, id asc
    ) as row_number
  from public.kiddush_items
)
delete from public.kiddush_items
where id in (
  select id
  from ranked_kiddush_items
  where row_number > 1
);

create unique index if not exists kiddush_items_name_unique_idx
  on public.kiddush_items (lower(name));

create table if not exists public.kiddush_reservations (
  id uuid primary key default gen_random_uuid(),
  shabbos_date date not null,
  sponsor_name text not null,
  sponsor_email text not null,
  sponsor_phone text,
  sponsorship_text text not null,
  items jsonb not null default '[]'::jsonb,
  special_requests text,
  item_subtotal_amount numeric(12, 2) not null default 0,
  base_fee_amount numeric(12, 2) not null default 0,
  minimum_adjustment_amount numeric(12, 2) not null default 0,
  subtotal_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  final_total_amount numeric(12, 2),
  special_request_amount numeric(12, 2),
  additional_amount numeric(12, 2) not null default 0,
  payment_method text,
  payment_status text not null default 'pending',
  payment_reference text,
  charge_id uuid,
  additional_charge_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.kiddush_reservations
  add column if not exists item_subtotal_amount numeric(12, 2) not null default 0,
  add column if not exists base_fee_amount numeric(12, 2) not null default 0,
  add column if not exists minimum_adjustment_amount numeric(12, 2) not null default 0,
  add column if not exists final_total_amount numeric(12, 2),
  add column if not exists special_request_amount numeric(12, 2),
  add column if not exists additional_amount numeric(12, 2) not null default 0,
  add column if not exists additional_charge_id uuid;

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
