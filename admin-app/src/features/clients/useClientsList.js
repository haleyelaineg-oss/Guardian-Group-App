import { useCallback, useEffect, useState } from 'react';
import * as clientsService from './clientsService.js';

export function useClientsList() {
  const [companies, setCompanies] = useState([]);
  const [participantsByCompany, setParticipantsByCompany] = useState({});
  const [membershipByCompany, setMembershipByCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
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
