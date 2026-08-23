export default function ClientTrainingRecords({ attendance, roster }) {
  const rosterById = Object.fromEntries(roster.map((m) => [m.id, m]));

  return (
    <>
      <div className="detail-section-title">Training Records</div>
      <div className="responses-table-wrap">
        <table className="responses-table">
          <thead><tr><th>Name</th><th>Workshop</th><th>Status</th><th>Certificate</th></tr></thead>
          <tbody>
            {attendance.length === 0 && <tr><td colSpan={4}>No training records yet.</td></tr>}
            {attendance.map((a) => (
              <tr key={a.id}>
                <td>{rosterById[a.participant_id]?.full_name || '—'}</td>
                <td>{a.workshop?.title || '—'}</td>
                <td><span className={`reg-card-status-badge ${a.status}`}>{a.status}</span></td>
                <td>{a.certificate_issued ? 'Issued' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
