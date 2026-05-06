create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to service_role;

create table if not exists private.legacy_addresses_import (
  id uuid primary key,
  legacy_user_id uuid not null,
  label text,
  full_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text,
  postal_code text,
  country text not null,
  is_default boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  source_file text not null default 'addresses-export-2026-05-06_03-12-00.csv',
  imported_at timestamptz not null default now()
);

comment on table private.legacy_addresses_import is
  'Legacy addresses from the old Supabase project. Staged here because public.addresses requires auth.users rows that do not exist yet in the new project.';

create index if not exists legacy_addresses_import_legacy_user_id_idx
  on private.legacy_addresses_import (legacy_user_id);

grant all on table private.legacy_addresses_import to service_role;

insert into private.legacy_addresses_import (
  id,
  legacy_user_id,
  label,
  full_name,
  phone,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  is_default,
  created_at,
  updated_at
)
values
  (
    '4ce1b7a9-1f74-49a2-a30e-9b6830fb818b',
    '0cbba26f-8198-42cd-95d8-cbbff65c5013',
    null,
    'Halima',
    '0245639787',
    'EN-041-1916',
    null,
    'Koforidua',
    null,
    null,
    'Ghana',
    true,
    '2026-01-12 15:40:19.254311+00',
    '2026-01-12 15:40:19.254311+00'
  ),
  (
    '308fbe48-adff-4d9f-9515-e63b368b304e',
    '75118e23-8226-47d3-89b3-ec16da4ac1be',
    'Home',
    'ja',
    '0535806980',
    'Adweso',
    null,
    'kof',
    'gha',
    '00233',
    'ghana',
    true,
    '2026-03-08 19:50:17.542676+00',
    '2026-03-08 19:50:17.542676+00'
  ),
  (
    'bdad2db8-df6e-4d84-9a5d-9a2ceea77bd3',
    'ba675802-45bc-45ee-b92e-b3e4cabb6cdc',
    'home',
    'jim',
    '0535806980',
    'ada',
    'ada',
    'ada',
    'ada',
    '00233',
    'ada',
    true,
    '2026-03-08 23:47:19.986982+00',
    '2026-03-08 23:47:19.986982+00'
  ),
  (
    '118b9d48-826b-490b-8cd3-bbe05dbd2913',
    'c402bec6-d8fc-49c6-992a-a8385ca58bf6',
    null,
    'Dia',
    '0245639787',
    'Monrovia',
    null,
    'koforidua',
    null,
    null,
    'Ghana',
    true,
    '2026-03-27 01:06:08.561816+00',
    '2026-03-27 01:06:08.561816+00'
  ),
  (
    'e38f2876-91eb-436a-9679-2e1e5b6006a0',
    '31c448f9-cb2f-4601-8a7a-3e0c0e79caa8',
    null,
    'Lima',
    '0245639787',
    'EN-041-1916',
    null,
    'Koforidua ',
    null,
    null,
    'Ghana',
    true,
    '2026-05-06 08:10:13.37386+00',
    '2026-05-06 08:10:13.37386+00'
  ),
  (
    'cdaf1f64-9928-477f-ac7f-92722f37a41c',
    '31c448f9-cb2f-4601-8a7a-3e0c0e79caa8',
    null,
    'Lima',
    '0245639787',
    'EN-041-1916',
    null,
    'Koforidua ',
    null,
    null,
    'Ghana',
    true,
    '2026-05-06 08:10:15.612241+00',
    '2026-05-06 08:10:15.612241+00'
  )
on conflict (id) do update set
  legacy_user_id = excluded.legacy_user_id,
  label = excluded.label,
  full_name = excluded.full_name,
  phone = excluded.phone,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  city = excluded.city,
  state = excluded.state,
  postal_code = excluded.postal_code,
  country = excluded.country,
  is_default = excluded.is_default,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  source_file = 'addresses-export-2026-05-06_03-12-00.csv';
