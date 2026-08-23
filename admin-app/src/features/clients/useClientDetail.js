import { useCallback, useEffect, useState } from 'react';
import * as clientsService from './clientsService.js';

export function useClientDetail(companyId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await clientsService.fetchClientDetail(companyId);
      setDetail(result);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { reload(); }, [reload]);

  async function saveOverview(values) {
    await clientsService.saveClientOverview(companyId, {
      ...values,
      currentPrimaryContactId: detail.company.primary_contact_participant_id,
    });
    await reload();
  }

  async function setOrgAdmin(participantId) {
    await clientsService.setCompanyOrgAdmin(companyId, participantId);
    await reload();
  }

  async function enableMembership() {
    await clientsService.enableMembership(companyId);
    await reload();
  }

  async function updateMembershipField(field, rawValue) {
    await clientsService.updateMembershipField(companyId, field, rawValue);
    await reload();
  }

  async function setUnlimitedSeats(unlimited) {
    await clientsService.setUnlimitedSeats(companyId, unlimited);
    await reload();
  }

  async function regenerateClientCode() {
    await clientsService.regenerateClientCode(companyId);
    await reload();
  }

  async function createRosterContact(values) {
    await clientsService.createRosterContact(companyId, values);
    await reload();
  }

  async function uploadDocument(file, linkedDocId) {
    await clientsService.uploadClientDocument(companyId, file, linkedDocId);
    await reload();
  }

  async function deleteDocument(id, path) {
    await clientsService.deleteClientDocument(id, path);
    await reload();
  }

  return {
    detail,
    loading,
    error,
    reload,
    saveOverview,
    setOrgAdmin,
    enableMembership,
    updateMembershipField,
    setUnlimitedSeats,
    regenerateClientCode,
    createRosterContact,
    uploadDocument,
    deleteDocument,
  };
}
