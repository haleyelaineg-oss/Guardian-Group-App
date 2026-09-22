import { useCallback, useEffect, useState } from 'react';
import * as clientsService from './clientsService.js';

export function useClientDetail(companyId) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // `reload` itself never touches `loading` on entry — only the effect
  // below does, and only when `companyId` actually changes (i.e. `reload`
  // gets a new identity). Mutation handlers call this same `reload()`
  // directly without going through that effect, so a save/upload/etc.
  // updates `detail` in place instead of unmounting the whole page while
  // it refetches — that unmount was breaking things like the document
  // upload's file-input ref (see ClientDocumentsSection).
  const reload = useCallback(async () => {
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

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    reload();
  }, [reload]);

  async function saveOverview(values) {
    await clientsService.saveClientOverview(companyId, {
      ...values,
      currentPrimaryContactId: detail.company.primary_contact_participant_id,
    });
  }

  async function provisionPortal(email) {
    const result = await clientsService.provisionCompanyPortal(companyId, email);
    await reload();
    return result;
  }

  async function disablePortal() {
    const result = await clientsService.disableCompanyPortal(companyId);
    await reload();
    return result;
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
    provisionPortal,
    disablePortal,
    createRosterContact,
    uploadDocument,
    deleteDocument,
  };
}
