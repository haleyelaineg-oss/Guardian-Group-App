// Generic modal shell — overlay + card + header(title, close ✕) + body.
// Replaces the vanilla app's per-modal handleModalOverlayClick(event)
// dispatcher (one big function checking event.target against every modal
// id in the app) with the standard React pattern: each instance closes
// itself when the click lands on the overlay, not the card.
export default function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal-overlay"
      style={{ display: 'flex' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
