create or replace function public.app_list_orders(p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  result jsonb;
begin
  perform private.require_app_passcode(p_passcode);

  select coalesce(
    jsonb_agg(
      to_jsonb(o) || jsonb_build_object(
        'admin_note', coalesce((
          select n.note
          from private.admin_order_notes n
          where n.order_id = o.id
        ), ''),
        'history', coalesce((
          select jsonb_agg(
            jsonb_build_object('at', h.created_at, 'text', h.event_text)
            order by h.created_at desc
          )
          from public.order_history h
          where h.order_id = o.id
        ), '[]'::jsonb)
      )
      order by o.updated_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.orders o;

  return result;
end;
$$;
