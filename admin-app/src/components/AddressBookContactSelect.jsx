import { useEffect, useState } from 'react';
import { fetchContacts } from '../features/addressBook/addressBookService.js';

export default function AddressBookContactSelect({ value = '', onChange, label = 'Contact from Address Book', className = 'field-group half' }) {
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    fetchContacts().then(setContacts).catch((error) => alert(error.message));
  }, []);

  return <label className={className}><span className="field-label">{label}</span><select className="field-input" value={value} onChange={(event) => onChange(contacts.find((contact) => contact.id === event.target.value) || null)}><option value="">— Choose a saved contact —</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name}{contact.companies?.name ? ` · ${contact.companies.name}` : ''}{contact.email ? ` (${contact.email})` : ''}</option>)}</select></label>;
}
