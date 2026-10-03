import { Resend } from 'resend';

const json = (response, status, body) => response.status(status).json(body);

const clean = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const parseBody = (body) => {
  if (body && typeof body === 'object') return body;
  return Object.fromEntries(new URLSearchParams(String(body || '')));
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return json(response, 405, { success: false, error: 'Method not allowed' });
  }

  const payload = parseBody(request.body);
  if (payload['bot-field']) return json(response, 200, { success: true });

  const name = clean(payload.name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const organization = clean(payload.organization, 180);
  const message = clean(payload.message, 5000);

  if (!name || !email || !message || !/^\S+@\S+\.\S+$/.test(email)) {
    return json(response, 400, { success: false, error: 'Please provide a valid name, email, and message.' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('Contact form is missing RESEND_API_KEY.');
    return json(response, 500, { success: false, error: 'Contact form is not configured.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = process.env.CONTACT_TO_EMAIL || 'info@guardiangroupsls.com';
  const from = process.env.CONTACT_FROM_EMAIL || 'Guardian Group Website <info@guardiangroupsls.com>';

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `Website inquiry from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Organization: ${organization || 'Not provided'}`,
        '',
        message,
      ].join('\n'),
      html: `
        <h2>New Guardian Group website inquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        <p><strong>Organization:</strong> ${escapeHtml(organization || 'Not provided')}</p>
        <hr>
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      `,
    });

    if (error) throw new Error(error.message || 'Email delivery failed.');
    return json(response, 200, { success: true });
  } catch (error) {
    console.error('Contact form email failed:', error);
    return json(response, 500, { success: false, error: 'Unable to send your message.' });
  }
}
