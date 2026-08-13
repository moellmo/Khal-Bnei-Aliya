create sequence if not exists public.yom_tov_assistance_family_id_seq;

create table if not exists public.yom_tov_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  family_id_number bigint not null default nextval('public.yom_tov_assistance_family_id_seq'),
  family_name text not null,
  contact_name text,
  email text,
  phone text,
  adults_count integer not null default 0 check (adults_count >= 0),
  children_under_3_count integer not null default 0 check (children_under_3_count >= 0),
  children_ages_3_8_rosh_hashanah integer not null default 0 check (children_ages_3_8_rosh_hashanah >= 0),
  children_ages_3_8_first_days_sukkos integer not null default 0 check (children_ages_3_8_first_days_sukkos >= 0),
  children_ages_3_8_shemini_atzeres integer not null default 0 check (children_ages_3_8_shemini_atzeres >= 0),
  children_ages_9_13_rosh_hashanah integer not null default 0 check (children_ages_9_13_rosh_hashanah >= 0),
  children_ages_9_13_first_days_sukkos integer not null default 0 check (children_ages_9_13_first_days_sukkos >= 0),
  children_ages_9_13_shemini_atzeres integer not null default 0 check (children_ages_9_13_shemini_atzeres >= 0),
  age_14_plus_rosh_hashanah integer not null default 0 check (age_14_plus_rosh_hashanah >= 0),
  age_14_plus_first_days_sukkos integer not null default 0 check (age_14_plus_first_days_sukkos >= 0),
  age_14_plus_shemini_atzeres integer not null default 0 check (age_14_plus_shemini_atzeres >= 0),
  total_people_in_family integer not null default 0 check (total_people_in_family >= 0),
  total_points numeric(12, 2) not null default 0 check (total_points >= 0),
  notes text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.yom_tov_assistance_family_id_seq
  owned by public.yom_tov_assistance_requests.family_id_number;

create index if not exists yom_tov_assistance_created_at_idx
  on public.yom_tov_assistance_requests (created_at desc);

create index if not exists yom_tov_assistance_family_id_idx
  on public.yom_tov_assistance_requests (family_id_number);
