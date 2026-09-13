import { useState } from 'react';
import SaveButton from '../../components/SaveButton.jsx';
import { EXPENSE_CATEGORIES, EXPENSE_TYPES, categoryForExpenseType, resetExpenseOptions, saveExpenseOptions } from '../expenses/expenseOptions.js';

const slug = (text) => text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const copy = (items) => items.map((item) => ({ ...item }));

function OptionList({ title, items, setItems, categories, isType = false }) {
  const update = (index, key, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: key === 'value' ? slug(value) : value } : item));
  const remove = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const add = () => setItems((current) => [...current, isType ? { value: '', label: '', category: categories[0]?.value || 'other_business_expense' } : { value: '', label: '' }]);
  return <section className="settings-card"><div className="settings-card-header"><div><h2>{title}</h2><p className="field-hint">Use short internal values; labels are what appear throughout the app.</p></div><button type="button" className="btn-sm btn-sm-ghost" onClick={add}>+ Add {isType ? 'Type' : 'Category'}</button></div><div className="settings-option-list">{items.map((item, index) => <div className="settings-option-row" key={`${item.value}-${index}`}><label><span>Label</span><input className="field-input" value={item.label} onChange={(event) => update(index, 'label', event.target.value)} /></label><label><span>Internal value</span><input className="field-input" value={item.value} onChange={(event) => update(index, 'value', event.target.value)} /></label>{isType && <label><span>Default category</span><select className="field-input" value={item.category || categoryForExpenseType(item.value)} onChange={(event) => update(index, 'category', event.target.value)}>{categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>}<button type="button" className="btn-sm btn-sm-ghost settings-delete" aria-label={`Delete ${item.label || 'option'}`} onClick={() => remove(index)}>×</button></div>)}</div></section>;
}

export default function SettingsPage() {
  const [categories, setCategories] = useState(() => copy(EXPENSE_CATEGORIES));
  const [types, setTypes] = useState(() => copy(EXPENSE_TYPES).map((type) => ({ ...type, category: type.category || categoryForExpenseType(type.value) })));
  const valid = (items) => items.length && items.every((item) => item.label.trim() && item.value.trim()) && new Set(items.map((item) => item.value)).size === items.length;
  const save = async () => {
    if (!valid(categories) || !valid(types)) throw new Error('Each category and type needs a unique label and internal value.');
    saveExpenseOptions({ categories, types });
    window.location.reload();
  };
  const restore = () => {
    if (!window.confirm('Restore the original expense categories and types?')) return;
    resetExpenseOptions();
    window.location.reload();
  };
  return <div className="view active settings-page"><div className="view-header"><div><h1 className="view-title">Settings</h1><p className="view-sub">Manage the options used when you add and organize expenses.</p></div></div><div className="settings-intro"><strong>Expense setup</strong><span>Changes apply across Expense forms and filters after you save.</span></div><OptionList title="Expense Categories" items={categories} setItems={setCategories} categories={categories} /><OptionList title="Expense Types" items={types} setItems={setTypes} categories={categories} isType /><div className="create-form-actions settings-actions"><button type="button" className="btn btn-ghost" onClick={restore}>Restore Defaults</button><SaveButton onSave={save} label="Save Settings" /></div></div>;
}
