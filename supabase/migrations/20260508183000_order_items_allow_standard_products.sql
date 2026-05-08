alter table public.order_items
  alter column product_variant_id drop not null;

alter table public.order_items
  add column if not exists product_id uuid references public.products(id) on delete set null;

update public.order_items oi
set product_id = pv.product_id
from public.product_variants pv
where oi.product_variant_id = pv.id
  and oi.product_id is null;

create index if not exists idx_order_items_product_id
  on public.order_items(product_id);
