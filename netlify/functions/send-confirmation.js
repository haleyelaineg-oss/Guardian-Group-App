const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { workshop, attendees, purchaser, registrationType, totalPaid } = JSON.parse(event.body);

    const dateStr = workshop.scheduled_at
      ? formatDateTime(workshop.scheduled_at)
      : (workshop.workshop_date ? formatDate(workshop.workshop_date) : 'Date TBD');

    const totalFormatted = formatCurrency(totalPaid);

    // Send to each attendee
    const attendeeEmails = attendees.map(attendee =>
      resend.emails.send({
        from: 'Guardian Group <info@guardiangroupsls.com>',
        to: attendee.email,
        subject: `You're registered: ${workshop.title}`,
        html: buildAttendeeEmail({ attendee, workshop, dateStr, totalPaid: totalFormatted })
      })
    );

    // Send receipt to purchaser only if they're not an attendee
    const purchaserIsAttendee = attendees.some(
      a => a.email.toLowerCase() === purchaser.email.toLowerCase()
    );

    const allSends = [...attendeeEmails];

    if (!purchaserIsAttendee) {
      allSends.push(
        resend.emails.send({
          from: 'Guardian Group <info@guardiangroupsls.com>',
          to: purchaser.email,
          subject: `Registration confirmed: ${workshop.title}`,
          html: buildPurchaserEmail({ purchaser, attendees, workshop, dateStr, totalPaid: totalFormatted })
        })
      );
    }

    await Promise.all(allSends);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };

  } catch (err) {
    console.error('Email error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};

// ── Email templates ───────────────────────────────────────────

function buildAttendeeEmail({ attendee, workshop, dateStr, totalPaid }) {
  const meetingSection = workshop.meeting_link
    ? `<div style="margin:28px 0;padding:20px 24px;background:#f0f4f8;border-radius:8px;border-left:4px solid #1a3a5c;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#4a6080;">Zoom Meeting Link</p>
        <a href="${escHtml(workshop.meeting_link)}" style="color:#1a3a5c;font-size:15px;font-weight:600;word-break:break-all;">${escHtml(workshop.meeting_link)}</a>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Keep this link handy — it's unique to this workshop.</p>
      </div>`
    : `<div style="margin:28px 0;padding:20px 24px;background:#f0f4f8;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#4a6080;">A Zoom link will be sent to you closer to the workshop date.</p>
      </div>`;

  return baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:22px;color:#1a3a5c;">You're registered!</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4a6080;">Hi ${escHtml(attendee.name)}, we look forward to seeing you at <strong>${escHtml(workshop.title)}</strong>.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      ${detailRow('Workshop', workshop.title)}
      ${workshop.facilitator ? detailRow('Facilitator', workshop.facilitator) : ''}
      ${detailRow('Date', dateStr)}
    </table>

    ${meetingSection}

    <p style="font-size:14px;color:#64748b;margin-top:24px;">If you have any questions, reply to this email or reach us at <a href="mailto:info@guardiangroupsls.com" style="color:#1a3a5c;">info@guardiangroupsls.com</a>.</p>
  `);
}

function buildPurchaserEmail({ purchaser, attendees, workshop, dateStr, totalPaid }) {
  const attendeeList = attendees
    .map(a => `<li style="margin-bottom:4px;">${escHtml(a.name)} — ${escHtml(a.email)}</li>`)
    .join('');

  return baseTemplate(`
    <h2 style="margin:0 0 4px;font-size:22px;color:#1a3a5c;">Registration confirmed</h2>
    <p style="margin:0 0 24px;font-size:15px;color:#4a6080;">Hi ${escHtml(purchaser.name)}, here's a summary of your registration for <strong>${escHtml(workshop.title)}</strong>.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
      ${detailRow('Workshop', workshop.title)}
      ${detailRow('Date', dateStr)}
      ${detailRow('Seats', String(attendees.length))}
      ${detailRow('Total paid', totalPaid)}
    </table>

    <div style="margin:28px 0;padding:20px 24px;background:#f0f4f8;border-radius:8px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#4a6080;">Attendees</p>
      <ul style="margin:0;padding-left:18px;font-size:14px;color:#1a3a5c;">
        ${attendeeList}
      </ul>
      <p style="margin:12px 0 0;font-size:12px;color:#64748b;">Each attendee will receive their own confirmation email with the Zoom link.</p>
    </div>

    <p style="font-size:14px;color:#64748b;margin-top:24px;">Questions? Reply to this email or contact us at <a href="mailto:info@guardiangroupsls.com" style="color:#1a3a5c;">info@guardiangroupsls.com</a>.</p>
  `);
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr><td style="background:#1a3a5c;padding:28px 36px;border-radius:10px 10px 0 0;text-align:center;">
          <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:.08em;color:#ffffff;text-transform:uppercase;">Guardian Group</p>
          <p style="margin:4px 0 0;font-size:11px;letter-spacing:.12em;color:#a0b8d0;text-transform:uppercase;">Safety &amp; Leadership Solutions</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:36px;border-radius:0 0 10px 10px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 0;text-align:center;">
          <p style="margin:0;font-size:11px;color:#94a3b8;">Guardian Group Safety &amp; Leadership Solutions &nbsp;·&nbsp; Beyond Compliance</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;width:120px;vertical-align:top;border-bottom:1px solid #e2e8f0;">${escHtml(label)}</td>
    <td style="padding:10px 0 10px 16px;font-size:15px;color:#1a3a5c;font-weight:500;border-bottom:1px solid #e2e8f0;">${escHtml(value)}</td>
  </tr>`;
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
