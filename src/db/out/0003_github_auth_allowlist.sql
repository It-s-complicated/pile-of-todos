create table if not exists public.github_auth_allowlist (
  provider_id text primary key,
  provider text not null default 'github',
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint github_auth_allowlist_provider_check check (provider = 'github')
);--> statement-breakpoint

create or replace function public.set_github_auth_allowlist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;--> statement-breakpoint

drop trigger if exists trg_github_auth_allowlist_updated_at on public.github_auth_allowlist;--> statement-breakpoint
create trigger trg_github_auth_allowlist_updated_at
before update on public.github_auth_allowlist
for each row
execute procedure public.set_github_auth_allowlist_updated_at();--> statement-breakpoint

insert into public.github_auth_allowlist (provider_id, note)
values ('REPLACE_WITH_APPROVED_GITHUB_PROVIDER_ID', 'Replace before enabling the auth hook')
on conflict (provider_id) do nothing;--> statement-breakpoint

create or replace function public.is_allowed_github_provider_id(candidate_provider_id text)
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.github_auth_allowlist
    where provider = 'github'
      and provider_id = candidate_provider_id
  );
$$;--> statement-breakpoint

create or replace function public.hook_allow_single_github_identity(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  auth_provider text;
  github_provider_id text;
begin
  auth_provider := coalesce(event->'user'->'app_metadata'->>'provider', '');

  if auth_provider <> 'github' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Only GitHub sign-in is allowed.',
        'http_code', 403
      )
    );
  end if;

  select coalesce(identity->>'provider_id', identity->'identity_data'->>'sub')
    into github_provider_id
  from jsonb_array_elements(coalesce(event->'user'->'identities', '[]'::jsonb)) identity
  where identity->>'provider' = 'github'
  limit 1;

  if github_provider_id is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'GitHub provider id missing from auth payload.',
        'http_code', 403
      )
    );
  end if;

  if not public.is_allowed_github_provider_id(github_provider_id) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'This GitHub account is not approved for access.',
        'http_code', 403
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;--> statement-breakpoint

grant usage on schema public to supabase_auth_admin;--> statement-breakpoint
grant select on table public.github_auth_allowlist to supabase_auth_admin;--> statement-breakpoint
grant execute on function public.is_allowed_github_provider_id(text) to supabase_auth_admin;--> statement-breakpoint
grant execute on function public.hook_allow_single_github_identity(jsonb) to supabase_auth_admin;--> statement-breakpoint
revoke execute on function public.hook_allow_single_github_identity(jsonb) from authenticated, anon, public;--> statement-breakpoint
revoke execute on function public.is_allowed_github_provider_id(text) from authenticated, anon, public;--> statement-breakpoint
