create table if not exists private.admin_order_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  note text not null,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

revoke all on table private.admin_order_notes from public, anon, authenticated;

create or replace function public.app_admin_get_order_note(
  p_passcode text,
  p_username text,
  p_password text,
  p_order_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_note text;
begin
  perform private.require_app_passcode(p_passcode);
  perform private.require_admin_credentials(p_username, p_password);

  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Siparis bulunamadi';
  end if;

  select n.note into v_note
  from private.admin_order_notes n
  where n.order_id = p_order_id;

  return coalesce(v_note, '');
end;
$$;

create or replace function public.app_admin_set_order_note(
  p_passcode text,
  p_username text,
  p_password text,
  p_order_id uuid,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_order_no text;
  v_old_note text;
  v_new_note text;
begin
  perform private.require_app_passcode(p_passcode);
  perform private.require_admin_credentials(p_username, p_password);

  select order_no into v_order_no
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Siparis bulunamadi';
  end if;

  v_new_note := nullif(btrim(coalesce(p_note, '')), '');
  if v_new_note is not null and char_length(v_new_note) > 1000 then
    raise exception 'Admin notu 1000 karakterden uzun olamaz';
  end if;

  select note into v_old_note
  from private.admin_order_notes
  where order_id = p_order_id;

  if v_new_note is null then
    delete from private.admin_order_notes where order_id = p_order_id;
  else
    insert into private.admin_order_notes(order_id, note, updated_by, updated_at)
    values (p_order_id, v_new_note, trim(p_username), now())
    on conflict (order_id) do update
      set note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at;
  end if;

  insert into private.admin_audit_log(admin_username, action, order_id, order_no, details)
  values (
    trim(p_username),
    'order_note_update',
    p_order_id,
    v_order_no,
    jsonb_build_object('old_note', v_old_note, 'new_note', v_new_note)
  );

  return true;
end;
$$;

grant execute on function public.app_admin_get_order_note(text, text, text, uuid) to anon, authenticated;
grant execute on function public.app_admin_set_order_note(text, text, text, uuid, text) to anon, authenticated;
