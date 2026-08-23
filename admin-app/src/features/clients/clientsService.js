// Pure Supabase data access for Clients — companies, company_membership,
// participants (roster), attendance (training records), documents
// (invoices, read-only here), and client_documents/'client-documents'
// storage. Mirrors js/admin.js's Clients section 1:1, including its exact
// error-message copy per call site (some duplicate-email messages differ
// in wording between call sites in the vanilla app — preserved as-is
// rather than consolidated).
import { supabase } from '../../lib/supabase.js';

// no DB — a shared pure helper, ported from generateClientCode() in admin.js
export function generateClientCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L — avoids read-aloud ambiguity
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Shared by the New Client contact-row company picker and Address Book's
// company filter/select — same query, same shape, one implementation.
export async function fetchCompaniesForSelect() {
  const { data, error } = await supabase.from('companies').select('id, name').order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchClientsList() {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, contact_name, contact_email, org_admin_participant_id')
    .order('name', { ascending: true });
  if (error) throw error;
  if (!companies || companies.length === 0) return { companies: [], participantsByCompany: {}, membershipByCompany: {} };

  const [{ data: allParticipants }, { data: memberships }] = await Promise.all([
    supabase.from('participants').select('id, company_id, is_active, auth_user_id').in('company_id', companies.map((c) => c.id)),
    supabase.from('company_membership').select('company_id, client_code, membership_tier, max_seats').in('company_id', companies.map((c) => c.id)),
  ]);

  const participantsByCompany = {};
  (allParticipants || []).forEach((p) => {
    (participantsByCompany[p.company_id] ||= []).push(p);
  });
  const membershipByCompany = {};
  (memberships || []).forEach((m) => { membershipByCompany[m.company_id] = m; });

  return { companies, participantsByCompany, membershipByCompany };
}

// Multi-step create — mirrors createCompany() in admin.js, minus its
// per-contact "assign to a different existing company" option (removed
// per Haley's request — every contact created here belongs to this new
// client; reassigning a contact to a different company is an Address Book
// edit-contact concern now). The first named contact is the primary
// contact; it does NOT roll back the company row if a later step
// (contacts, membership) fails — reports each failure as a warning and
// still leaves the company created. Only a failure on the initial
// `companies` insert itself aborts and throws.
export async function createCompany({ name, contacts, billingAddress, tier, maxSeats, unlimitedSeats }) {
  const primary = contacts[0] || null;
  const others = contacts.slice(1);

  const { data: co, error } = await supabase.from('companies').insert({
    name,
    contact_name: primary ? primary.name : null,
    contact_email: primary ? primary.email : null,
    billing_address: billingAddress || null,
  }).select().single();
  if (error) throw new Error('Error creating client: ' + error.message);

  const warnings = [];
  let contactErr = null;

  if (primary) {
    const { data: inserted, error: err } = await supabase.from('participants').insert({
      full_name: primary.name,
      company_id: co.id,
      email: primary.email,
      phone: primary.phones[0]?.number || null,
      phones: primary.phones,
      title: primary.title,
      notes: primary.notes,
    }).select('id').single();
    contactErr = err;
    if (!err && inserted) {
      await supabase.from('companies').update({ primary_contact_participant_id: inserted.id }).eq('id', co.id);
    }
  }

  if (!contactErr && others.length) {
    const { error: err } = await supabase.from('participants').insert(others.map((c) => ({
      full_name: c.name,
      company_id: co.id,
      email: c.email,
      phone: c.phones[0]?.number || null,
      phones: c.phones,
      title: c.title,
      notes: c.notes,
    })));
    contactErr = contactErr || err;
  }

  if (contactErr) {
    warnings.push(/duplicate key|unique/i.test(contactErr.message)
      ? 'Client created, but one of those contact emails is already on file for someone else — link them from the Address Book instead.'
      : 'Client created, but saving contacts failed: ' + contactErr.message);
  }

  const { error: memErr } = await supabase.from('company_membership').insert({
    company_id: co.id,
    client_code: generateClientCode(),
    membership_tier: tier || null,
    max_seats: unlimitedSeats ? null : (maxSeats || 5),
  });
  if (memErr) warnings.push('Client created, but membership setup failed: ' + memErr.message);

  return { company: co, warnings };
}

export async function deleteCompany(companyId) {
  const { error } = await supabase.from('companies').delete().eq('id', companyId);
  if (error) {
    throw new Error(/foreign key|violates/i.test(error.message)
      ? "Can't delete this client — they still have contacts, registrants, or training records on file. Remove those first (Address Book) before deleting the client."
      : 'Could not delete client: ' + error.message);
  }
}

export async function fetchClientDetail(companyId) {
  const [{ data: company }, { data: membership }, { data: roster }] = await Promise.all([
    supabase.from('companies').select('id, name, contact_name, contact_email, phones, billing_address, primary_contact_participant_id, org_admin_participant_id').eq('id', companyId).single(),
    supabase.from('company_membership').select('company_id, client_code, membership_tier, max_seats').eq('company_id', companyId).maybeSingle(),
    supabase.from('participants').select('id, full_name, email, phone, title, is_active, auth_user_id').eq('company_id', companyId).order('full_name', { ascending: true }),
  ]);
  if (!company) return null;

  const members = roster || [];
  const memberIds = members.map((m) => m.id);

  const [{ data: attendanceRows }, { data: invoiceRows }, { data: clientDocRows }] = await Promise.all([
    memberIds.length
      ? supabase.from('attendance').select('id, participant_id, status, certificate_issued, workshop:workshop_id(title)').in('participant_id', memberIds)
      : Promise.resolve({ data: [] }),
    supabase.from('documents').select('id, doc_type, doc_number, status, total, doc_date, due_date').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('client_documents').select('id, document_id, file_name, storage_path, file_size, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
  ]);

  return {
    company,
    membership: membership || null,
    roster: members,
    attendance: attendanceRows || [],
    invoices: invoiceRows || [],
    clientDocuments: clientDocRows || [],
  };
}

export async function upsertPrimaryContact(companyId, existingParticipantId, fullName, email) {
  if (!fullName) return { id: null, error: null };
  if (existingParticipantId) {
    const { error } = await supabase.from('participants').update({ full_name: fullName, email }).eq('id', existingParticipantId);
    return { id: existingParticipantId, error };
  }
  const { data, error } = await supabase.from('participants').insert({ full_name: fullName, email, company_id: companyId }).select('id').single();
  return { id: data?.id || null, error };
}

export async function saveClientOverview(companyId, { contactName, contactEmail, phones, billingAddress, currentPrimaryContactId }) {
  let primaryContactId = contactName ? currentPrimaryContactId : null;
  if (contactName) {
    const { id, error } = await upsertPrimaryContact(companyId, currentPrimaryContactId, contactName, contactEmail);
    if (error) {
      throw new Error(/duplicate key|unique/i.test(error.message)
        ? 'That email is already on file for another contact — link them from the Address Book instead.'
        : 'Could not save primary contact: ' + error.message);
    }
    primaryContactId = id;
  }

  const { error } = await supabase.from('companies').update({
    contact_name: contactName,
    contact_email: contactEmail,
    phones,
    billing_address: billingAddress,
    primary_contact_participant_id: primaryContactId,
  }).eq('id', companyId);
  if (error) throw new Error('Could not save: ' + error.message);
}

export async function setCompanyOrgAdmin(companyId, participantId) {
  const { error } = await supabase.from('companies').update({ org_admin_participant_id: participantId || null }).eq('id', companyId);
  if (error) throw new Error('Could not update org admin: ' + error.message);
}

export async function enableMembership(companyId) {
  const { error } = await supabase.from('company_membership').insert({ company_id: companyId, client_code: generateClientCode(), max_seats: 5 });
  if (error) throw new Error('Could not enable membership: ' + error.message);
}

// Batched save for the whole membership panel (tier, seats, unlimited) —
// one "Save Membership" click, not a per-field immediate save. Only Copy
// and Regenerate stay immediate, per Haley's request.
export async function saveMembership(companyId, { tier, maxSeats, unlimited }) {
  const { error } = await supabase.from('company_membership').update({
    membership_tier: tier?.trim() || null,
    max_seats: unlimited ? null : (parseInt(maxSeats, 10) || 0),
  }).eq('company_id', companyId);
  if (error) throw new Error('Could not save: ' + error.message);
}

export async function regenerateClientCode(companyId) {
  const { error } = await supabase.from('company_membership').update({ client_code: generateClientCode() }).eq('company_id', companyId);
  if (error) throw new Error('Could not regenerate code: ' + error.message);
}

export async function createRosterContact(companyId, { fullName, email, phone, title, notes }) {
  const { error } = await supabase.from('participants').insert({
    full_name: fullName, company_id: companyId, email: email || null, phone: phone || null, title: title || null, notes: notes || null,
  });
  if (error) {
    throw new Error(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not add contact: ' + error.message);
  }
}

export async function uploadClientDocument(companyId, file, linkedDocId) {
  const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('client-documents').upload(path, file);
  if (upErr) throw new Error('Upload failed: ' + upErr.message);

  const { error: insErr } = await supabase.from('client_documents').insert({
    company_id: companyId, document_id: linkedDocId || null, file_name: file.name, storage_path: path, file_size: file.size,
  });
  if (insErr) throw new Error('Could not save document record: ' + insErr.message);
}

export async function getClientDocumentSignedUrl(path) {
  const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, 300);
  if (error || !data) throw new Error('Could not open file: ' + (error ? error.message : 'unknown error'));
  return data.signedUrl;
}

export async function deleteClientDocument(id, path) {
  await supabase.storage.from('client-documents').remove([path]); // not error-checked in the vanilla app either — proceeds regardless
  const { error } = await supabase.from('client_documents').delete().eq('id', id);
  if (error) throw new Error('Could not delete: ' + error.message);
}
