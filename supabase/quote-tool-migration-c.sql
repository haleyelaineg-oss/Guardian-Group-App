-- Allow one quote or invoice to be linked to multiple calendar events.
-- `documents.event_id` remains as a legacy/primary link for compatibility;
-- this junction table is the canonical set of linked events going forward.

create table if not exists public.document_event_links (
  document_id uuid not null references public.documents(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, event_id)
);

create index if not exists idx_document_event_links_event_id
  on public.document_event_links(event_id);

insert into public.document_event_links (document_id, event_id)
select id, event_id
from public.documents
where event_id is not null
on conflict (document_id, event_id) do nothing;

alter table public.document_event_links enable row level security;
revoke all on table public.document_event_links from anon;
grant select, insert, update, delete on table public.document_event_links to authenticated;

drop policy if exists "staff all document event links" on public.document_event_links;
create policy "staff all document event links" on public.document_event_links
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- The application keeps documents.event_id populated for one-event documents
-- and sets it to null for shared documents. Existing single-event cleanup
-- therefore remains unchanged, while shared documents are protected from it.
