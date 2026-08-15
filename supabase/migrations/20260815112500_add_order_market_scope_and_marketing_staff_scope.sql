alter table public.orders
  add column if not exists market_scope text;

alter table public.staff
  add column if not exists marketing_scope text;

alter table public.orders
  drop constraint if exists orders_market_scope_check;
alter table public.orders
  add constraint orders_market_scope_check
  check (market_scope is null or market_scope in ('domestic','international'));

alter table public.staff
  drop constraint if exists staff_marketing_scope_check;
alter table public.staff
  add constraint staff_marketing_scope_check
  check (marketing_scope is null or marketing_scope in ('domestic','international','both'));

update public.staff
set marketing_scope = 'both'
where 'marketing' = any(roles)
  and marketing_scope is null;

create or replace function public.app_create_order_scoped(
  p_passcode text,
  p_order_no text,
  p_customer text,
  p_market_scope text,
  p_requirements text[] default '{}'::text[],
  p_note text default null,
  p_marketing_owner_id uuid default null
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

  insert into public.orders(
    order_no,
    customer,
    market_scope,
    requirements,
    note,
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
    'warehouse1',
    'Bekleniyor',
    p_marketing_owner_id
  )
  returning id into new_id;

  insert into public.order_history(order_id, event_text)
  values (
    new_id,
    actor_name || ' siparisi olusturdu (' || scope_label || ') ve Depo''ya gonderdi: Bekleniyor'
  );

  return new_id;
end;
$$;

revoke all on function public.app_create_order_scoped(text,text,text,text,text[],text,uuid) from public;
grant execute on function public.app_create_order_scoped(text,text,text,text,text[],text,uuid) to anon, authenticated;

create or replace function public.app_admin_set_marketing_scope(
  p_passcode text,
  p_username text,
  p_password text,
  p_staff_id uuid,
  p_scope text
)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_name text;
  v_roles text[];
  v_old_scope text;
  v_new_scope text;
begin
  perform private.require_app_passcode(p_passcode);
  perform private.require_admin_credentials(p_username, p_password);

  select name, roles, marketing_scope
    into v_name, v_roles, v_old_scope
  from public.staff
  where id = p_staff_id;

  if not found then
    raise exception 'Personel bulunamadi';
  end if;

  if 'marketing' = any(v_roles) then
    if p_scope not in ('domestic','international','both') then
      raise exception 'Pazarlama alani secimi zorunludur';
    end if;
    v_new_scope := p_scope;
  else
    v_new_scope := null;
  end if;

  update public.staff
  set marketing_scope = v_new_scope
  where id = p_staff_id;

  insert into private.admin_audit_log(admin_username, action, details)
  values (
    trim(p_username),
    'marketing_scope_change',
    jsonb_build_object(
      'staff_id', p_staff_id,
      'staff_name', v_name,
      'old_scope', v_old_scope,
      'new_scope', v_new_scope
    )
  );

  return true;
end;
$$;

revoke all on function public.app_admin_set_marketing_scope(text,text,text,uuid,text) from public;
grant execute on function public.app_admin_set_marketing_scope(text,text,text,uuid,text) to anon, authenticated;
