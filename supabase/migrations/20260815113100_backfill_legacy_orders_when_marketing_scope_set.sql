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
  v_backfilled integer := 0;
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

  if v_new_scope in ('domestic','international') then
    update public.orders
    set market_scope = v_new_scope
    where marketing_owner_id = p_staff_id
      and market_scope is null;
    get diagnostics v_backfilled = row_count;
  end if;

  insert into private.admin_audit_log(admin_username, action, details)
  values (
    trim(p_username),
    'marketing_scope_change',
    jsonb_build_object(
      'staff_id', p_staff_id,
      'staff_name', v_name,
      'old_scope', v_old_scope,
      'new_scope', v_new_scope,
      'legacy_orders_classified', v_backfilled
    )
  );

  return true;
end;
$$;
