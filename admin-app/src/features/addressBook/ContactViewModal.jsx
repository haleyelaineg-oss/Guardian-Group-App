import Modal from '../../components/Modal.jsx';

export default function ContactViewModal({ contact, onClose, onEdit }) {
  const isOrgAdmin = contact.companies?.org_admin_participant_id === contact.id;
  const phones = (contact.phones && contact.phones.length)
    ? contact.phones.filter((ph) => ph.number)
    : (contact.phone ? [{ type: 'Office', number: contact.phone }] : []);

  return (
    <Modal
      title={<>{contact.full_name || 'Contact'} {isOrgAdmin && <span className="wc-badge">Org Admin</span>}</>}
      onClose={onClose}
    >
      <div className="fields-grid">
        <div className="field-group half">
          <div className="detail-label">Company</div>
          <div className="detail-value">{contact.companies?.name || '—'}</div>
        </div>
        <div className="field-group half">
          <div className="detail-label">Title</div>
          <div className="detail-value">{contact.title || '—'}</div>
        </div>
        <div className="field-group full">
          <div className="detail-label">Email</div>
          <div className="detail-value">{contact.email || '—'}</div>
        </div>
        <div className="field-group full">
          <div className="detail-label">Phone Numbers</div>
          <div className="detail-value">
            {phones.length
              ? phones.map((ph, i) => <div key={i}>{ph.type || 'Phone'}: {ph.number}</div>)
              : '—'}
          </div>
        </div>
        <div className="field-group full">
          <div className="detail-label">Notes</div>
          <div className="detail-value">{contact.notes || '—'}</div>
        </div>
      </div>
      <div className="create-form-actions">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={onEdit}>Edit →</button>
      </div>
    </Modal>
  );
}
