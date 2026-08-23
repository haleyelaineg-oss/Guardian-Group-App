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

  const reload = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { fetchCompaniesForSelect().then(setCompanyOptions); }, []);

  async function createContact(payload) {
    await addressBookService.createContact(payload);
    await reload();
  }

  async function updateContact(id, payload) {
    await addressBookService.updateContact(id, payload);
    await reload();
  }

  async function deleteContact(id, name) {
    await addressBookService.deleteContact(id, name);
    await reload();
  }

  return { contacts, companyOptions, loading, error, createContact, updateContact, deleteContact };
}
