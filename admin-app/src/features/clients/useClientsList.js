import { useCallback, useEffect, useState } from 'react';
import * as clientsService from './clientsService.js';

export function useClientsList() {
  const [companies, setCompanies] = useState([]);
  const [participantsByCompany, setParticipantsByCompany] = useState({});
  const [membershipByCompany, setMembershipByCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Doesn't set loading=true on entry — only the initial mount (loading
  // starts true) shows the full-page loading state; a delete-triggered
  // reload just swaps the table's data in place. See useClientDetail.js
  // for the fuller version of this — this hook has no changing "id" to
  // reset on, so it doesn't need the extra effect that one has.
  const reload = useCallback(async () => {
    try {
      const result = await clientsService.fetchClientsList();
      setCompanies(result.companies);
      setParticipantsByCompany(result.participantsByCompany);
      setMembershipByCompany(result.membershipByCompany);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function deleteClient(companyId) {
    await clientsService.deleteCompany(companyId);
    await reload();
  }

  return { companies, participantsByCompany, membershipByCompany, loading, error, reload, deleteClient };
}
