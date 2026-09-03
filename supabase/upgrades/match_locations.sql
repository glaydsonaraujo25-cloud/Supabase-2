-- Optional planning metadata; existing records and permissions are preserved.
alter table public.matches add column if not exists venue text check (length(venue)<=200);
alter table public.matches add column if not exists duration_minutes integer check (duration_minutes between 1 and 1440);
notify pgrst,'reload schema';
