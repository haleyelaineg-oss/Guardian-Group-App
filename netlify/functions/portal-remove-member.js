// ============================================================
// GUARDIAN GROUP — portal-remove-member.js
// Lets a company's own org-admin remove a member from their
// company's portal roster, freeing up a membership seat. Uses the
// Supabase SERVICE ROLE key — server-only — because verifying the
// caller's identity from their access token and revoking another
// user's auth account both require elevated privileges the public
// anon key does not have.
//
// ENV VARS REQUIRED (set in Netlify site settings):
//   SUPABASE_URL              — same project URL as js/config.js
//   SUPABASE_SERVICE_ROLE_KEY — service_role key from Supabase API settings (secret)
// ============================================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const respond = (statusCode, payload) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  try {
    const { accessToken, targetParticipantId } = JSON.parse(event.body || '{}');

    if (!accessToken || !targetParticipantId) {
      return respond(400, { success: false, error: 'Missing required fields.' });
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return respond(401, { success: false, error: 'Not authenticated. Please sign in again.' });
    }

    const { data: caller } = await admin
      .from('participants')
      .select('id, company_id')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (!caller) {
      return respond(403, { success: false, error: 'You are not authorized to manage members.' });
    }

    const { data: company } = await admin
      .from('companies')
      .select('id, org_admin_participant_id')
      .eq('id', caller.company_id)
      .single();

    if (!company || company.org_admin_participant_id !== caller.id) {
      return respond(403, { success: false, error: 'You are not authorized to manage members.' });
    }

    const { data: target } = await admin
      .from('participants')
      .select('id, company_id, auth_user_id')
      .eq('id', targetParticipantId)
      .single();

    if (!target) {
      return respond(404, { success: false, error: 'Member not found.' });
    }
    if (target.company_id !== caller.company_id) {
      return respond(403, { success: false, error: 'You are not authorized to manage members.' });
    }
    if (target.id === caller.id) {
      return respond(400, { success: false, error: "You can't remove yourself. Contact Guardian Group staff to change the organization admin." });
    }

    const { error: updateErr } = await admin
      .from('participants')
      .update({ is_active: false, auth_user_id: null })
      .eq('id', target.id);

    if (updateErr) throw updateErr;

    if (target.auth_user_id) {
      await admin.auth.admin.deleteUser(target.auth_user_id);
    }

    return respond(200, { success: true });
  } catch (err) {
    console.error('portal-remove-member error:', err);
    return respond(500, { success: false, error: 'Something went wrong. Please try again.' });
  }
};
