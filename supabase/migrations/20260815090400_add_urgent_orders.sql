alter table public.orders
  add column if not exists urgent boolean not null default false;

drop function if exists public.app_create_order_scoped(text, text, text, text, text[], text, uuid);

create function public.app_create_order_scoped(
  p_passcode text,
  p_order_no text,
  p_customer text,
  p_market_scope text,
  p_requirements text[] default '{}'::text[],
  p_note text default null,
  p_marketing_owner_id uuid default null,
  p_urgent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  new_id uuid;
  actor_name text;
  actor_scope text;
  scope_label text;
  urgent_label text;
begin
  perform private.require_app_passcode(p_passcode);
  perform private.require_staff_role(p_marketing_owner_id, 'marketing');

  if nullif(trim(p_order_no), '') is null or nullif(trim(p_customer), '') is null then
    raise exception 'Siparis no ve musteri zorunludur';
  end if;

  if p_market_scope not in ('domestic','international') then
    raise exception 'Yurt Ici / Yurt Disi secimi zorunludur';
  end if;

  select name, marketing_scope
    into actor_name, actor_scope
  from public.staff
  where id = p_marketing_owner_id;

  if actor_scope in ('domestic','international') and actor_scope <> p_market_scope then
    raise exception 'Bu Pazarlama personeli bu siparis turune yetkili degil';
  end if;

  scope_label := case p_market_scope
    when 'domestic' then 'Yurt Ici'
    when 'international' then 'Yurt Disi'
  end;
  urgent_label := case when coalesce(p_urgent, false) then 'ACIL olarak ' else '' end;

  insert into public.orders(
    order_no,
    customer,
    market_scope,
    requirements,
    note,
    urgent,
    phase,
    warehouse1_status,
    marketing_owner_id
  )
  values (
    trim(p_order_no),
    trim(p_customer),
    p_market_scope,
    coalesce(p_requirements, '{}'::text[]),
    nullif(trim(coalesce(p_note,'')),''),
    coalesce(p_urgent, false),
    'warehouse1',
    'Bekleniyor',
    p_marketing_owner_id
  )
  returning id into new_id;

  insert into public.order_history(order_id, event_text)
  values (
    new_id,
    actor_name || ' siparisi ' || urgent_label || 'olusturdu (' || scope_label || ') ve Depo''ya gonderdi: Bekleniyor'
  );

  return new_id;
end;
$$;

grant execute on function public.app_create_order_scoped(text, text, text, text, text[], text, uuid, boolean) to anon, authenticated;
