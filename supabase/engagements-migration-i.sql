-- ============================================================
-- GUARDIAN GROUP — Engagements, Migration I
-- Replaces the session-library materials note with a physical
-- materials list plus reusable uploaded files and web links.
-- Run after engagements-migration-h.sql.
-- ============================================================

alter table presentation_sessions
  add column if not exists physical_materials text;

create table if not exists presentation_session_materials (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  presentation_session_id uuid not null references presentation_sessions(id) on delete cascade,
  material_type           text not null check (material_type in ('link', 'file')),
  label                   text not null,
  url                     text,
  file_name               text,
  file_size               bigint,
  storage_path            text,
  notes                   text,
  check (
    (material_type = 'link' and url is not null and storage_path is null)
    or (material_type = 'file' and storage_path is not null and url is null)
  )
);
create index if not exists idx_presentation_session_materials_session_id
  on presentation_session_materials(presentation_session_id);

alter table presentation_session_materials enable row level security;
create policy "staff all presentation_session_materials" on presentation_session_materials
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public)
values ('session-materials', 'session-materials', false)
on conflict (id) do nothing;
create policy "staff all session-materials objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'session-materials' and public.is_staff())
  with check (bucket_id = 'session-materials' and public.is_staff());
