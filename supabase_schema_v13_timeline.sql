create table if not exists match_timelines (
  match_id text primary key,
  timeline_json jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table match_timelines enable row level security;

create policy "Everyone can read match_timelines"
on match_timelines for select
to authenticated
using (true);

create policy "Authenticated users can insert match_timelines"
on match_timelines for insert
to authenticated
with check (true);
