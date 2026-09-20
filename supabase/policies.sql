alter table public.rooms enable row level security;
alter table public.player_secrets enable row level security;

create or replace function public.current_player_id()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-player-id', '')
$$;

drop policy if exists "rooms can be created by browser players" on public.rooms;
create policy "rooms can be created by browser players"
on public.rooms for insert
to anon, authenticated
with check (host_player_id = public.current_player_id());

drop policy if exists "rooms can be read by participants or code users" on public.rooms;
create policy "rooms can be read by participants or code users"
on public.rooms for select
to anon, authenticated
using (true);

drop policy if exists "participants can update their room" on public.rooms;
create policy "participants can update their room"
on public.rooms for update
to anon, authenticated
using (
  public.current_player_id() in (host_player_id, guest_player_id)
  or guest_player_id is null
)
with check (public.current_player_id() in (host_player_id, guest_player_id));

drop policy if exists "players insert their own secrets" on public.player_secrets;
create policy "players insert their own secrets"
on public.player_secrets for insert
to anon, authenticated
with check (
  player_id = public.current_player_id()
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = public.current_player_id()
      and rooms.guest_player_id = player_secrets.player_id
  )
);

drop policy if exists "players update their own secrets" on public.player_secrets;
create policy "players update their own secrets"
on public.player_secrets for update
to anon, authenticated
using (
  player_id = public.current_player_id()
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = public.current_player_id()
      and rooms.guest_player_id = player_secrets.player_id
  )
)
with check (
  player_id = public.current_player_id()
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = public.current_player_id()
      and rooms.guest_player_id = player_secrets.player_id
  )
);

drop policy if exists "players read only their own secrets" on public.player_secrets;
create policy "players read only their own secrets"
on public.player_secrets for select
to anon, authenticated
using (player_id = public.current_player_id());
