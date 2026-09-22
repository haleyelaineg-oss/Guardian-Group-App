import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [participants, setParticipants] = useState([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTrainingAttendanceRoster(training.id, training.company_id);
      setRoster(result.roster);
      setParticipants(result.participants);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the attendance roster.');
    } finally {
      setLoading(false);
    }
  }, [training.id, training.company_id]);

  useEffect(() => { reload(); }, [reload]);

  const rosterParticipantIds = useMemo(
    () => new Set(roster.map((row) => row.participant_id)),
    [roster],
  );
  const availableParticipants = participants.filter((participant) => !rosterParticipantIds.has(participant.id));
  const completedCount = roster.filter((row) => row.status === 'completed').length;
  const presentCount = roster.filter((row) => row.status === 'attended' || row.status === 'completed').length;
  const certificateCount = roster.filter((row) => row.certificate_issued).length;

  async function addParticipant() {
    if (!selectedParticipantId) return;
    setWorkingId('add');
    try {
      await addTrainingAttendee(training, selectedParticipantId);
      setSelectedParticipantId('');
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
      <p className="view-sub">Add employees from this client, track attendance, and issue certificates. These records appear in the client portal.</p>

      <div className="reg-summary-bar training-roster-summary">
        <div className="reg-summary-stat"><span className="reg-summary-num">{roster.length}</span><span className="reg-summary-label">On roster</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{presentCount}</span><span className="reg-summary-label">Attended</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{completedCount}</span><span className="reg-summary-label">Completed</span></div>
        <div className="reg-summary-stat"><span className="reg-summary-num">{certificateCount}</span><span className="reg-summary-label">Certificates</span></div>
      </div>

      <div className="create-form-card training-roster-add">
        <div className="field-group full">
          <label className="field-label" htmlFor="trainingRosterParticipant">Add employee</label>
          <div className="training-roster-add-row">
            <select
              id="trainingRosterParticipant"
              className="field-input"
              value={selectedParticipantId}
              onChange={(event) => setSelectedParticipantId(event.target.value)}
            >
              <option value="">— Choose from {training.companies?.name || 'client'} contacts —</option>
              {availableParticipants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.full_name}{participant.email ? ` — ${participant.email}` : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" disabled={!selectedParticipantId || workingId === 'add'} onClick={addParticipant}>
              {workingId === 'add' ? 'Adding…' : 'Add to Roster'}
            </button>
          </div>
          {availableParticipants.length === 0 && <p className="field-hint">Everyone currently associated with this client is already on the roster. Add new employees from the client’s Address Book.</p>}
        </div>
      </div>

      {error ? (
        <section className="empty-hint" role="alert">{error} <button className="btn-sm btn-sm-ghost" onClick={reload}>Try Again</button></section>
      ) : (
        <div className="responses-table-wrap">
          <table className="responses-table training-roster-table">
            <thead><tr><th>Employee</th><th>Status</th><th>Certificate</th><th></th></tr></thead>
            <tbody>
              {roster.length === 0 && <tr><td colSpan={4}>No one has been added to this training yet.</td></tr>}
              {roster.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.participant?.full_name || '—'}</strong><span className="table-secondary">{row.participant?.email || ''}</span></td>
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

