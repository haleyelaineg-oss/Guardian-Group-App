-- Invoice payment synchronization. `payments` and `payment_allocations` are
-- the canonical payment ledger; invoice summaries are derived from it.

alter table documents add column if not exists payment_details text;

create or replace function public.sync_invoice_payment_summary(p_document_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total numeric; v_paid numeric; v_paid_date date;
begin
  select d.total into v_total from documents d where d.id = p_document_id and d.doc_type = 'invoice';
  if not found then return; end if;
  select coalesce(sum(case when p.direction = 'refund' then -pa.allocated_amount else pa.allocated_amount end), 0), max(p.received_at::date) filter (where p.direction <> 'refund')
    into v_paid, v_paid_date
    from payment_allocations pa join payments p on p.id = pa.payment_id where pa.document_id = p_document_id;
  v_paid := greatest(v_paid, 0);
  update documents set amount_paid = v_paid, balance = greatest(coalesce(v_total, 0) - v_paid, 0),
    status = case when coalesce(v_total, 0) > 0 and v_paid >= v_total then 'paid' when v_paid > 0 then 'partially_paid' when status = 'paid' then 'sent' else status end,
    date_paid = case when coalesce(v_total, 0) > 0 and v_paid >= v_total then coalesce(v_paid_date, date_paid) else null end
  where id = p_document_id;
end $$;

-- Payment route is operational metadata, separate from revenue and payment
-- status. Speaking defaults to direct payment; training defaults to invoice.
alter table income add column if not exists payment_path text;
update income
set payment_path = case
  when source_type = 'speaking' then 'direct'
  when source_type = 'training' then 'invoice'
  else 'direct'
end
where payment_path is null;
alter table income alter column payment_path set default 'direct';
alter table income alter column payment_path set not null;
alter table income drop constraint if exists income_payment_path_check;
alter table income add constraint income_payment_path_check check (payment_path in ('invoice', 'direct', 'no_charge'));

-- Prospects remain on their event/engagement record; they are not financial
-- records. New income is confirmed by default. Existing potential rows are
-- retained for history but excluded from financial summaries.
alter table income alter column certainty_status set default 'confirmed';

create or replace function public.sync_invoice_payment_summary_from_allocation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_invoice_payment_summary(coalesce(new.document_id, old.document_id));
  if tg_op = 'UPDATE' and new.document_id is distinct from old.document_id then perform public.sync_invoice_payment_summary(old.document_id); end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_sync_invoice_payment_summary on payment_allocations;
create trigger trg_sync_invoice_payment_summary after insert or update or delete on payment_allocations for each row execute function public.sync_invoice_payment_summary_from_allocation();

create or replace function public.sync_invoice_payment_summary_from_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.doc_type = 'invoice' and (tg_op = 'INSERT' or new.total is distinct from old.total or new.doc_type is distinct from old.doc_type) then perform public.sync_invoice_payment_summary(new.id); end if;
  return new;
end $$;
drop trigger if exists trg_sync_invoice_payment_summary_from_document on documents;
create trigger trg_sync_invoice_payment_summary_from_document after insert or update of total, doc_type on documents for each row execute function public.sync_invoice_payment_summary_from_document();

-- Atomically records an invoice payment and creates a canonical Income/link
-- for legacy standalone invoices that do not yet have one.
create or replace function public.record_invoice_payment(p_document_id uuid, p_amount numeric, p_received_at date default current_date, p_payment_method text default null, p_reference text default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_document documents%rowtype; v_income_id uuid; v_payment_id uuid;
begin
  if auth.uid() is not null and not public.is_staff() then raise exception 'Unauthorized'; end if;
  if p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  select * into v_document from documents where id = p_document_id and doc_type = 'invoice' for update;
  if not found then raise exception 'Invoice not found'; end if;
  select income_id into v_income_id from income_document_links where document_id = p_document_id limit 1;
  if v_income_id is null then
    insert into income (category, description, amount, expected_on, status, notes, certainty_status, income_kind, company_id, source_type, legacy_document_id)
    values ('other', coalesce(v_document.doc_number, 'Invoice') || ' — ' || coalesce(v_document.client_name, 'Unnamed client'), v_document.total, coalesce(v_document.due_date, current_date), 'expected', 'Created automatically when recording an invoice payment', 'confirmed', 'service_revenue', v_document.company_id, 'manual', v_document.id) returning id into v_income_id;
    insert into income_document_links (income_id, document_id, allocated_amount) values (v_income_id, p_document_id, v_document.total);
  end if;
  insert into payments (amount, received_at, payment_method, reference, notes) values (p_amount, coalesce(p_received_at, current_date), nullif(p_payment_method, ''), nullif(p_reference, ''), nullif(p_notes, '')) returning id into v_payment_id;
  insert into payment_allocations (payment_id, income_id, document_id, allocated_amount) values (v_payment_id, v_income_id, p_document_id, p_amount);
  return v_payment_id;
end $$;
revoke all on function public.record_invoice_payment(uuid, numeric, date, text, text, text) from public;
grant execute on function public.record_invoice_payment(uuid, numeric, date, text, text, text) to authenticated;

-- Preserve payments made in the older invoice editor by turning each existing
-- non-ledger amount into a canonical payment before calculating summaries.
do $$
declare r record;
begin
  for r in select id, amount_paid, date_paid, payment_method, payment_method_other, payment_details from documents d where d.doc_type = 'invoice' and coalesce(d.amount_paid, 0) > 0 and not exists (select 1 from payment_allocations pa where pa.document_id = d.id) loop
    perform public.record_invoice_payment(r.id, r.amount_paid, coalesce(r.date_paid, current_date), coalesce(r.payment_method_other, r.payment_method), null, r.payment_details);
  end loop;
  for r in select id from documents where doc_type = 'invoice' loop perform public.sync_invoice_payment_summary(r.id); end loop;
end $$;
