// Pure Supabase data access for Address Book. Mirrors js/admin.js's
// Address Book section — with one deliberate efficiency change from the
// vanilla version, noted where it happens: see fetchContacts().
import { supabase } from '../../lib/supabase.js';

// Vanilla's loadAddressBook() re-runs this entire query on every keystroke
// in the search box (the oninput handler calls loadAddressBook() again),
// even though the search itself is only ever applied client-side after the
// fetch. Here the query only depends on companyFilter (the one server-side
// filter); status + search are applied client-side by the caller against
// already-fetched rows — same end result, just without re-querying
// Supabase on every keystroke.
export async function fetchContacts(companyFilter) {
  let query = supabase
    .from('participants')
    .select('id, full_name, email, phone, phones, title, notes, company_id, is_active, auth_user_id, companies!company_id(name, org_admin_participant_id)')
    .order('full_name', { ascending: true });
  if (companyFilter) query = query.eq('company_id', companyFilter);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createContact(payload) {
  const { error } = await supabase.from('participants').insert(payload);
  if (error) {
    throw new Error(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not add contact: ' + error.message);
  }
}

export async function updateContact(id, payload) {
  const { error } = await supabase.from('participants').update(payload).eq('id', id);
  if (error) {
    throw new Error(/duplicate key|unique/i.test(error.message) ? 'That email is already on file for another contact.' : 'Could not save: ' + error.message);
  }
}

export async function deleteContact(id, name) {
  const { error } = await supabase.from('participants').delete().eq('id', id);
  if (error) {
    throw new Error(/foreign key|violates/i.test(error.message)
      ? `Can't remove ${name} — they have training or registration history on file.`
      : 'Could not remove contact: ' + error.message);
  }
}
