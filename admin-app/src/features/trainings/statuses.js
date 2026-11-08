export const TRAINING_STATUSES = [
  'inquiry',
  'proposal_sent',
  'contract_pending',
  'scheduled',
  'completed',
  'invoice_sent',
  'paid',
  'cancelled_by_client',
  'cancelled_by_guardian_group',
];

export const TRAINING_STATUS_LABELS = {
  inquiry: 'Inquiry Received',
  proposal_sent: 'Pending (Proposal/Quote Sent)',
  contract_pending: 'Pending (Agreement Sent - Awaiting Client Signature)',
  scheduled: 'Confirmed (Scheduled)',
  completed: 'Completed (Not Yet Invoiced)',
  invoice_sent: 'Completed (Invoice Sent)',
  paid: 'Completed (Invoice Paid)',
  cancelled_by_client: 'Cancelled (by Client)',
  cancelled_by_guardian_group: 'Cancelled (by Guardian Group)',
};

const LEGACY_STATUS_MAP = {
  planning: 'scheduled',
  ready: 'scheduled',
  payment_pending: 'invoice_sent',
  cancelled: 'cancelled_by_client',
};

export function normalizeTrainingStatus(status) {
  return LEGACY_STATUS_MAP[status] || status || 'inquiry';
}

export function trainingStatusLabel(status) {
  const normalized = normalizeTrainingStatus(status);
  return TRAINING_STATUS_LABELS[normalized] || normalized;
}

export function isCancelledTrainingStatus(status) {
  return normalizeTrainingStatus(status).startsWith('cancelled_by_');
}

export function isConfirmedTrainingStatus(status) {
  return ['scheduled', 'completed', 'invoice_sent', 'paid'].includes(normalizeTrainingStatus(status));
}

export function trainingCalendarStatus(status) {
  const normalized = normalizeTrainingStatus(status);
  if (normalized === 'scheduled') return 'confirmed';
  if (['completed', 'invoice_sent', 'paid'].includes(normalized)) return 'completed';
  if (isCancelledTrainingStatus(normalized)) return 'cancelled';
  return 'planning';
}
