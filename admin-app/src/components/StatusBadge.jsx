const TONES = {
  cancelled: 'danger', declined: 'danger', withdrawn: 'danger', denied: 'danger', past_due: 'danger', expired: 'danger',
  completed: 'open', paid: 'open', closed: 'open', confirmed: 'open', accepted: 'open', issued: 'open',
  planning: 'info', ready: 'info', scheduled: 'info', selected: 'info', contracting: 'info',
  inquiry: 'pending', opportunity: 'pending', preparing_submission: 'pending', applied: 'pending', under_review: 'pending', proposal_sent: 'pending', contract_pending: 'pending', invoice_pending: 'pending', payment_pending: 'pending',
};

export default function StatusBadge({ status }) {
  const value = status || 'unknown';
  return <span className={`status-badge tone-${TONES[value] || 'neutral'}`}>{value.replaceAll('_', ' ')}</span>;
}
