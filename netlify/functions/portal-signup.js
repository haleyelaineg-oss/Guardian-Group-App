// ============================================================
// GUARDIAN GROUP — portal-signup.js
// Self-serve client-portal signup, gated by a per-company Client
// Code (see supabase/portal-migration-c.sql / company_membership).
// Uses the Supabase SERVICE ROLE key — server-only — because
// validating a code and creating an auth user both require
// elevated privileges the public anon key does not have.
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
    const { clientCode, fullName, email, password } = JSON.parse(event.body || '{}');

    if (!clientCode || !fullName || !email || !password) {
      return respond(400, { success: false, error: 'Please fill in all fields.' });
    }
    if (password.length < 8) {
      return respond(400, { success: false, error: 'Password must be at least 8 characters.' });
    }

    const code = clientCode.trim().toUpperCase();

    const { data: membership } = await admin
      .from('company_membership')
      .select('company_id, max_seats')
      .eq('client_code', code)
      .maybeSingle();

    if (!membership) {
      return respond(400, { success: false, error: 'Invalid client code. Please check with your company administrator.' });
    }

    const { count: activeCount } = await admin
      .from('participants')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', membership.company_id)
      .eq('is_active', true)
      .not('auth_user_id', 'is', null);

    if (membership.max_seats !== null && (activeCount || 0) >= membership.max_seats) {
      return respond(403, { success: false, error: 'Your company has reached its member limit. Contact your organization admin to free up a seat.' });
    }

    const emailLower = email.trim().toLowerCase();
    const { data: existing } = await admin
      .from('participants')
      .select('id, auth_user_id')
      .eq('email_lower', emailLower)
      .maybeSingle();

    if (existing?.auth_user_id) {
      return respond(409, { success: false, error: 'An account with this email already exists. Try signing in instead.' });
    }

    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createErr) {
      if (/already registered|already exists/i.test(createErr.message || '')) {
        return respond(409, { success: false, error: 'An account with this email already exists. Try signing in instead.' });
      }
      throw createErr;
    }

    const newUserId = userData.user.id;

    const { data: participant, error: rpcErr } = await admin
      .rpc('upsert_participant_for_registration', {
        p_full_name: fullName,
        p_email: email,
        p_company_id: membership.company_id
      })
      .single();

    if (rpcErr || !participant) {
      await admin.auth.admin.deleteUser(newUserId);
      throw rpcErr || new Error('Could not create participant record.');
    }

    const { error: linkErr } = await admin
      .from('participants')
      .update({ auth_user_id: newUserId, is_active: true })
      .eq('id', participant.id);

    if (linkErr) {
      await admin.auth.admin.deleteUser(newUserId);
      if (/SEAT_LIMIT_REACHED/.test(linkErr.message || '')) {
        return respond(403, { success: false, error: 'Your company has reached its member limit. Contact your organization admin to free up a seat.' });
      }
      throw linkErr;
    }

    return respond(200, { success: true });
  } catch (err) {
    console.error('portal-signup error:', err);
    return respond(500, { success: false, error: 'Something went wrong. Please try again.' });
  }
};
