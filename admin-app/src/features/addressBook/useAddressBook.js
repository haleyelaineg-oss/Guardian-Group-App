import { useCallback, useEffect, useState } from 'react';
import * as addressBookService from './addressBookService.js';
import { fetchCompaniesForSelect } from '../clients/clientsService.js';

// companyFilter is owned by the caller (mirrors useClientDetail(companyId)
// — a param that should trigger a refetch, same idea as a route param).
export function useAddressBook(companyFilter) {
  const [contacts, setContacts] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // See useClientDetail.js for why `reload` itself never sets loading=true
  // — only the effect below does, and only when companyFilter changes
  // (a new `reload` identity), not on every create/edit/delete refresh.
  const reload = useCallback(async () => {
    try {
      const rows = await addressBookService.fetchContacts(companyFilter || null);
      setContacts(rows);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [companyFilter]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);
  useEffect(() => { fetchCompaniesForSelect().then(setCompanyOptions); }, []);

  async function createContact(payload) {
    await addressBookService.createContact(payload);
  }

  async function updateContact(id, payload) {
    await addressBookService.updateContact(id, payload);
  }

  async function deleteContact(id, name) {
    await addressBookService.deleteContact(id, name);
    await reload();
  }

  return { contacts, companyOptions, loading, error, reload, createContact, updateContact, deleteContact };
}
