const TONES = {
  cancelled: 'danger', cancelled_submission_withdrawn: 'danger', cancelled_event_cancelled: 'danger', declined: 'danger', withdrawn: 'danger', submission_rejected: 'danger', denied: 'danger', past_due: 'danger', expired: 'danger',
  completed: 'open', completed_payment_pending: 'open', completed_paid: 'open', paid: 'open', closed: 'open', confirmed: 'open', accepted: 'open', issued: 'open',
  planning: 'info', ready: 'info', scheduled: 'info', selected: 'info', submission_accepted: 'info', contracting: 'info',
  inquiry: 'pending', opportunity: 'pending', preparing_submission: 'pending', applied: 'pending', application_pending_response: 'pending', under_review: 'pending', proposal_sent: 'pending', contract_pending: 'pending', invoice_pending: 'pending', invoice_sent: 'pending', payment_pending: 'pending',
};
const LABELS = { invoice_pending: 'Invoice Sent', invoice_sent: 'Invoice Sent', application_pending_response: 'Application Pending Response', submission_accepted: 'Submission Accepted', submission_rejected: 'Submission Rejected', completed_payment_pending: 'Completed: Payment Pending', completed_paid: 'Completed: Paid', cancelled_submission_withdrawn: 'Cancelled: Submission Withdrawn', cancelled_event_cancelled: 'Cancelled: Event Cancelled' };

export default function StatusBadge({ status }) {
  const value = status || 'unknown';
  return <span className={`status-badge tone-${TONES[value] || 'neutral'}`}>{LABELS[value] || value.replaceAll('_', ' ')}</span>;
}
