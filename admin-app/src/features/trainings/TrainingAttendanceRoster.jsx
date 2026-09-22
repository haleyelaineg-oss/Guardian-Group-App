import { useCallback, useEffect, useState } from 'react';
import LoadingIndicator from '../../components/LoadingIndicator.jsx';
import {
  addTrainingAttendee,
  fetchTrainingAttendanceRoster,
  issueTrainingCertificate,
  removeTrainingAttendee,
  updateTrainingAttendanceStatus,
} from './trainingService.js';

const STATUS_OPTIONS = [
  ['registered', 'Registered'],
  ['attended', 'Attended'],
  ['completed', 'Completed'],
  ['no_show', 'No show'],
];

export default function TrainingAttendanceRoster({ training }) {
  const [roster, setRoster] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [person, setPerson] = useState({ firstName: '', lastName: '', companyId: training.company_id || '', position: '' });
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTrainingAttendanceRoster(training.id);
      setRoster(result.roster);
      setCompanies(result.companies);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the attendance roster.');
    } finally {
      setLoading(false);
    }
  }, [training.id]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    setPerson({ firstName: '', lastName: '', companyId: training.company_id || '', position: '' });
  }, [training.id, training.company_id]);
  const completedCount = roster.filter((row) => row.status === 'completed').length;
  const presentCount = roster.filter((row) => row.status === 'attended' || row.status === 'completed').length;
  const certificateCount = roster.filter((row) => row.certificate_issued).length;

  async function addParticipant() {
    const values = {
      firstName: person.firstName.trim(),
      lastName: person.lastName.trim(),
      companyId: person.companyId,
      position: person.position.trim(),
    };
    if (!values.firstName || !values.lastName || !values.companyId) return;
    setWorkingId('add');
    try {
      await addTrainingAttendee(training, values);
      setPerson((current) => ({ ...current, firstName: '', lastName: '', position: '' }));
      await reload();
    } catch (err) {
      alert(err.message || 'Could not add this person to the roster.');
    } finally {
      setWorkingId('');
    }
  }

  async function changeStatus(row, status) {
    setWorkingId(row.id);
    try {
      await updateTrainingAttendanceStatus(row.id, status);
      await reload();
    } catch (err) {
      alert(err.message || 'Could not update attendance.');
    } finally {
      setWorkingId('');
    }
  }

  async function issueCertificate(row) {
    setWorkingId(row.id);
    try {
      await issueTrainingCertificate(row.id);
      await reload();
    } catch (err) {
      alert(err.message || 'Could not issue the certificate.');
    } finally {
      setWorkingId('');
    }
  }

  async function removeParticipant(row) {
    const name = row.participant?.full_name || 'this person';
    if (!confirm(`Remove ${name} from this training roster?`)) return;
    setWorkingId(row.id);
    try {
      await removeTrainingAttendee(row.id);
      await reload();
    } catch (err) {
      alert(err.message || 'Could not remove this person.');
    } finally {
      setWorkingId('');
    }
  }

  if (loading && roster.length === 0) return <LoadingIndicator label="Loading attendance roster…" />;

  return (
    <section className="training-attendance-roster">
      <div className="detail-section-title">Attendance Roster</div>
      <p className="view-sub">Add attendees from your client list, track attendance, and issue certificates. Each record appears in the selected company’s client portal.</p>

      <div className="reg-summary-bar training-roster-summary">
        <div className="reg-summary-stat"><span className="reg-summary-num">{roster.length}</span><span className="reg-summary-label">On roster</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{presentCount}</span><span className="reg-summary-label">Attended</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{completedCount}</span><span className="reg-summary-label">Completed</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{certificateCount}</span><span className="reg-summary-label">Certificates</span></div>
      </div>

      <div className="create-form-card training-roster-add">
        <div className="training-roster-person-grid">
          <label className="field-group">
            <span className="field-label">First Name</span>
            <input className="field-input" autoComplete="given-name" value={person.firstName} onChange={(event) => setPerson({ ...person, firstName: event.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Last Name</span>
            <input className="field-input" autoComplete="family-name" value={person.lastName} onChange={(event) => setPerson({ ...person, lastName: event.target.value })} />
          </label>
          <label className="field-group">
            <span className="field-label">Company</span>
            <select className="field-input" value={person.companyId} onChange={(event) => setPerson({ ...person, companyId: event.target.value })}>
              <option value="">— Select client —</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </label>
          <label className="field-group">
            <span className="field-label">Position</span>
            <input className="field-input" autoComplete="organization-title" value={person.position} onChange={(event) => setPerson({ ...person, position: event.target.value })} />
          </label>
        </div>
        <div className="create-form-actions">
          <button
            className="btn btn-primary"
            disabled={!person.firstName.trim() || !person.lastName.trim() || !person.companyId || workingId === 'add'}
            onClick={addParticipant}
          >
            {workingId === 'add' ? 'Adding…' : 'Add to Roster'}
          </button>
        </div>
      </div>

      {error ? (
        <section className="empty-hint" role="alert">{error} <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section>
      ) : (
        <div className="responses-table-wrap">
          <table className="responses-table training-roster-table">
            <thead><tr><th>Employee</th><th>Company</th><th>Position</th><th>Status</th><th>Certificate</th><th></th></tr></thead>
            <tbody>
              {roster.length === 0 && <tr><td colSpan={6}>No one has been added to this training yet.</td></tr>}
              {roster.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.participant?.full_name || '—'}</strong><span className="table-secondary">{row.participant?.email || ''}</span></td>
                  <td>{row.participant?.company?.name || '—'}</td>
                  <td>{row.participant?.title || '—'}</td>
                  <td>
                    <select
                      className="attendance-status-select"
                      value={row.status || 'registered'}
                      disabled={workingId === row.id || row.certificate_issued}
                      title={row.certificate_issued ? 'Certificate issued; attendance is locked as completed.' : 'Update attendance status'}
                      onChange={(event) => changeStatus(row, event.target.value)}
                    >
                      {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    {row.certificate_issued
                      ? <><span className="reg-card-status-badge attended">Issued</span><span className="table-secondary">{row.certificate_number}</span></>
                      : row.status === 'completed'
                        ? <button className="btn-sm btn-sm-ghost" disabled={workingId === row.id} onClick={() => issueCertificate(row)}>Issue Certificate</button>
                        : <span className="table-secondary">Complete training first</span>}
                  </td>
                  <td><button className="btn-sm btn-sm-danger" disabled={workingId === row.id} onClick={() => removeParticipant(row)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
