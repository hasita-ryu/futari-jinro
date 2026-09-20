alter table public.rooms enable row level security;
alter table public.player_secrets enable row level security;

drop policy if exists "rooms can be created by browser players" on public.rooms;
drop policy if exists "rooms can be read by participants or code users" on public.rooms;
drop policy if exists "participants can update their room" on public.rooms;
drop policy if exists "players insert their own secrets" on public.player_secrets;
drop policy if exists "players update their own secrets" on public.player_secrets;
drop policy if exists "players read only their own secrets" on public.player_secrets;

drop function if exists public.current_player_id();

create policy "rooms can be created by browser players"
on public.rooms for insert
to authenticated
with check (host_player_id = auth.uid()::text);

create policy "rooms can be read by participants or code users"
on public.rooms for select
to authenticated
using (true);

create policy "participants can update their room"
on public.rooms for update
to authenticated
using (
  auth.uid()::text in (host_player_id, guest_player_id)
  or guest_player_id is null
)
with check (auth.uid()::text in (host_player_id, guest_player_id));

create policy "players insert their own secrets"
on public.player_secrets for insert
to authenticated
with check (
  player_id = auth.uid()::text
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = auth.uid()::text
      and rooms.guest_player_id = player_secrets.player_id
  )
);

create policy "players update their own secrets"
on public.player_secrets for update
to authenticated
using (
  player_id = auth.uid()::text
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = auth.uid()::text
      and rooms.guest_player_id = player_secrets.player_id
  )
)
with check (
  player_id = auth.uid()::text
  or exists (
    select 1 from public.rooms
    where rooms.code = room_code
      and rooms.host_player_id = auth.uid()::text
      and rooms.guest_player_id = player_secrets.player_id
  )
);

create policy "players read only their own secrets"
on public.player_secrets for select
to authenticated
using (player_id = auth.uid()::text);
