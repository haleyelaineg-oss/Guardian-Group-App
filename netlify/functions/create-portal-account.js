// ============================================================
// GUARDIAN GROUP — create-portal-account.js
// Auto-provisions a client portal login for each new participant
// written by a registration. Uses the Supabase SERVICE ROLE key
// (server-only — never expose this in js/config.js) to call the
// Auth admin API, which requires elevated privileges the public
// anon key does not have.
//
// ENV VARS REQUIRED (set in Netlify site settings):
//   SUPABASE_URL              — same project URL as js/config.js
//   SUPABASE_SERVICE_ROLE_KEY — service_role key from Supabase API settings (secret)
//   SITE_URL                  — e.g. https://guardiangroupsls.com
//
// Also requires a one-time manual step in the Supabase dashboard:
// Authentication → URL Configuration → add
// "<SITE_URL>/portal/set-password.html" to the redirect allow-list.
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

  try {
    const { participants, companyId, purchaserId, registrationType } = JSON.parse(event.body);
    const accounts = [];

    for (const p of (participants || [])) {
      if (!p?.email || !p?.id) continue;

      const { data: existing } = await admin
        .from('participants')
        .select('auth_user_id')
        .eq('id', p.id)
        .single();

      if (existing?.auth_user_id) {
        // Already has a portal account (repeat registrant) — nothing to do
        accounts.push({ email: p.email, setPasswordLink: null });
        continue;
      }

      let { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: p.email,
        options: {
          data: { full_name: p.name },
          redirectTo: `${process.env.SITE_URL}/portal/set-password.html`
        }
      });

      // If an auth user already exists for this email (e.g. registered again
      // before this feature shipped, or a duplicate-email edge case), fall
      // back to a recovery link instead of failing outright.
      if (linkErr) {
        ({ data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: p.email,
          options: { redirectTo: `${process.env.SITE_URL}/portal/set-password.html` }
        }));
      }

      if (!linkErr && linkData?.user?.id) {
        await admin.from('participants').update({ auth_user_id: linkData.user.id }).eq('id', p.id);
        accounts.push({ email: p.email, setPasswordLink: linkData.properties?.action_link ?? null });
      } else {
        console.error('Portal account provisioning failed for', p.email, linkErr);
        accounts.push({ email: p.email, setPasswordLink: null });
      }
    }

    // Default org-admin assignment: whoever registered others for their
    // company becomes that company's org admin, unless one is already set.
    if (companyId && purchaserId && (registrationType === 'myself_and_others' || registrationType === 'others_only')) {
      await admin
        .from('companies')
        .update({ org_admin_participant_id: purchaserId })
        .eq('id', companyId)
        .is('org_admin_participant_id', null);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, accounts })
    };
  } catch (err) {
    console.error('create-portal-account error:', err);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
