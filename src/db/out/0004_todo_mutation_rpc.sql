create or replace function public.apply_todo_mutation(intent jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  acting_user_id uuid := auth.uid();
  mutation_kind text := coalesce(intent->>'kind', '');
  requested_mutation_id text := coalesce(intent->>'mutationId', '');
  requested_todo_id uuid := nullif(intent->>'todoId', '')::uuid;
  mutation_values jsonb := coalesce(intent->'values', '{}'::jsonb);
  requested_label text := nullif(trim(coalesce(mutation_values->>'label', '')), '');
  requested_week_number integer := case
    when mutation_values ? 'weekNumber' and jsonb_typeof(mutation_values->'weekNumber') <> 'null'
      then (mutation_values->>'weekNumber')::integer
    else null
  end;
  requested_done boolean := case
    when mutation_values ? 'done' then (mutation_values->>'done')::boolean
    else null
  end;
  requested_archived boolean := case
    when mutation_values ? 'archived' then (mutation_values->>'archived')::boolean
    else null
  end;
  requested_created_at bigint := case
    when mutation_values ? 'createdAt' and jsonb_typeof(mutation_values->'createdAt') <> 'null'
      then (mutation_values->>'createdAt')::bigint
    else null
  end;
  requested_updated_at bigint := case
    when mutation_values ? 'updatedAt' and jsonb_typeof(mutation_values->'updatedAt') <> 'null'
      then (mutation_values->>'updatedAt')::bigint
    else null
  end;
  requested_deleted_at bigint := case
    when mutation_values ? 'deletedAt' and jsonb_typeof(mutation_values->'deletedAt') <> 'null'
      then (mutation_values->>'deletedAt')::bigint
    else null
  end;
  requested_device_id text := nullif(coalesce(intent->'client'->>'deviceId', ''), '');
begin
  if acting_user_id is null then
    raise exception 'apply_todo_mutation requires an authenticated user';
  end if;

  if requested_mutation_id = '' then
    raise exception 'apply_todo_mutation requires mutationId';
  end if;

  if requested_todo_id is null then
    raise exception 'apply_todo_mutation requires todoId';
  end if;

  if mutation_kind = 'create' then
    if requested_label is null then
      raise exception 'create intent requires a non-empty label';
    end if;

    if requested_done is null or requested_archived is null then
      raise exception 'create intent requires done and archived flags';
    end if;

    if requested_created_at is null or requested_updated_at is null then
      raise exception 'create intent requires createdAt and updatedAt';
    end if;

    insert into public.todos (
      id,
      label,
      week_number,
      done,
      archived,
      created_at,
      updated_at,
      device_id,
      user_id,
      deleted_at
    )
    values (
      requested_todo_id,
      requested_label,
      requested_week_number,
      requested_done,
      requested_archived,
      requested_created_at,
      requested_updated_at,
      requested_device_id,
      acting_user_id,
      requested_deleted_at
    );

    return jsonb_build_object('mutationId', requested_mutation_id, 'todoId', requested_todo_id);
  end if;

  if requested_updated_at is null then
    raise exception 'update and delete intents require updatedAt';
  end if;

  if mutation_kind = 'update' then
    update public.todos
    set label = case when mutation_values ? 'label' then requested_label else label end,
        week_number = case when mutation_values ? 'weekNumber' then requested_week_number else week_number end,
        done = case when mutation_values ? 'done' then requested_done else done end,
        archived = case when mutation_values ? 'archived' then requested_archived else archived end,
        deleted_at = case when mutation_values ? 'deletedAt' then requested_deleted_at else deleted_at end,
        updated_at = requested_updated_at,
        device_id = coalesce(requested_device_id, device_id)
    where id = requested_todo_id
      and user_id = acting_user_id;

    if not found then
      raise exception 'todo % was not found for the authenticated user', requested_todo_id;
    end if;

    return jsonb_build_object('mutationId', requested_mutation_id, 'todoId', requested_todo_id);
  end if;

  if mutation_kind = 'delete' then
    if requested_deleted_at is null then
      raise exception 'delete intent requires deletedAt';
    end if;

    update public.todos
    set deleted_at = requested_deleted_at,
        updated_at = requested_updated_at,
        device_id = coalesce(requested_device_id, device_id)
    where id = requested_todo_id
      and user_id = acting_user_id;

    if not found then
      raise exception 'todo % was not found for the authenticated user', requested_todo_id;
    end if;

    return jsonb_build_object('mutationId', requested_mutation_id, 'todoId', requested_todo_id);
  end if;

  raise exception 'apply_todo_mutation does not support kind %', mutation_kind;
end;
$$;--> statement-breakpoint

grant execute on function public.apply_todo_mutation(jsonb) to authenticated;--> statement-breakpoint
revoke execute on function public.apply_todo_mutation(jsonb) from anon, public;--> statement-breakpoint
