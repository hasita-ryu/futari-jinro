create table if not exists public.rooms (
  code text primary key check (code ~ '^[0-9]{6}$'),
  host_player_id text not null,
  guest_player_id text,
  player_names jsonb not null default '{"p1":"プレイヤー1","p2":""}'::jsonb,
  selected_role_ids jsonb not null default '[]'::jsonb,
  status text not null default 'waiting',
  round_number integer not null default 0,
  public_state jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{"p1":0,"p2":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_secrets (
  id bigserial primary key,
  room_code text not null references public.rooms(code) on delete cascade,
  player_id text not null,
  slot text not null check (slot in ('p1', 'p2')),
  round_number integer not null,
  secret_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (room_code, player_id, round_number)
);

create index if not exists rooms_updated_at_idx on public.rooms(updated_at desc);
create index if not exists player_secrets_lookup_idx on public.player_secrets(room_code, player_id, round_number);

alter publication supabase_realtime add table public.rooms;
