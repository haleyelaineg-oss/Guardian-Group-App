export const EXPENSE_CATEGORIES = [
  ['advertising', 'Advertising'], ['car_truck_expenses', 'Car & Truck Expenses'], ['commissions_fees', 'Commissions & Fees'], ['contract_labor', 'Contract Labor'], ['depreciation_section_179', 'Depreciation / Section 179'], ['employee_benefits', 'Employee Benefits'], ['fuel', 'Fuel'], ['insurance', 'Insurance'], ['interest', 'Interest'], ['legal_professional_services', 'Legal & Professional Services'], ['meals', 'Meals'], ['office_expense', 'Office Expense'], ['other_business_expense', 'Other Business Expense'], ['rent_lease', 'Rent / Lease'], ['repairs_maintenance', 'Repairs & Maintenance'], ['supplies', 'Supplies'], ['taxes_licenses', 'Taxes & Licenses'], ['travel', 'Travel'], ['utilities', 'Utilities'], ['wages_payroll', 'Wages / Payroll'],
].map(([value, label]) => ({ value, label }));

export const EXPENSE_TYPES = [
  ['accounting', 'Accounting'], ['airfare', 'Airfare'], ['baggage', 'Baggage'], ['business_mileage', 'Business Mileage (use Add Mileage)'], ['childcare', 'Childcare'], ['client_meal', 'Client Meal'], ['equipment', 'Equipment'], ['fuel', 'Fuel'], ['fuel_personal_vehicle', 'Fuel — Personal Vehicle'], ['fuel_rental_vehicle', 'Fuel — Rental Vehicle'], ['general_liability', 'General Liability'], ['ground_transportation', 'Ground Transportation'], ['lodging', 'Hotel / Lodging'], ['insurance', 'Insurance'], ['marketing', 'Marketing'], ['materials', 'Materials'], ['meals', 'Meals'], ['mileage', 'Mileage (Legacy)'], ['office', 'Office'], ['other', 'Other'], ['parking', 'Parking'], ['pet_care', 'Pet Care'], ['printing', 'Printing'], ['professional_services', 'Professional Services'], ['registration', 'Registration'], ['rental_car', 'Rental Car'], ['shipping', 'Shipping'], ['social_media_advertising', 'Social Media Advertising'], ['software', 'Software'], ['tolls', 'Tolls'], ['training_materials', 'Training Materials'], ['travel', 'Travel (General)'], ['venue', 'Venue'],
].map(([value, label]) => ({ value, label }));

export const EXPENSE_STATUSES = ['planned', 'paid', 'reimbursed'];
export const TAX_TREATMENT_OPTIONS = [{ value: 'deductible', label: 'Deductible' }, { value: 'non_deductible', label: 'Non-deductible' }, { value: 'partially_deductible', label: 'Partially deductible' }, { value: 'needs_review', label: 'Needs review' }];
export const REIMBURSEMENT_OPTIONS = [{ value: 'not_applicable', label: 'None' }, { value: 'submitted', label: 'Pending Reimbursement' }, { value: 'reimbursed', label: 'Reimbursement Received' }];

const TYPE_CATEGORY = {
  travel: 'travel', airfare: 'travel', lodging: 'travel', rental_car: 'travel', mileage: 'car_truck_expenses', parking: 'travel', tolls: 'travel', baggage: 'travel', ground_transportation: 'travel', fuel: 'fuel', fuel_rental_vehicle: 'travel', fuel_personal_vehicle: 'car_truck_expenses', business_mileage: 'car_truck_expenses',
  meals: 'meals', client_meal: 'meals', social_media_advertising: 'advertising', marketing: 'advertising', materials: 'supplies', training_materials: 'supplies',
  venue: 'rent_lease', registration: 'other_business_expense', childcare: 'other_business_expense', pet_care: 'other_business_expense', printing: 'office_expense', shipping: 'office_expense',
  software: 'office_expense', office: 'office_expense', insurance: 'insurance', general_liability: 'insurance', professional_services: 'legal_professional_services', accounting: 'legal_professional_services', equipment: 'depreciation_section_179', other: 'other_business_expense',
};

export function categoryForExpenseType(type) { return TYPE_CATEGORY[type] || 'other_business_expense'; }
export function labelForExpenseCategory(value) { return EXPENSE_CATEGORIES.find((option) => option.value === value)?.label || String(value || 'other_business_expense').replaceAll('_', ' '); }
export function labelForExpenseType(value) { return EXPENSE_TYPES.find((option) => option.value === value)?.label || String(value || 'other').replaceAll('_', ' '); }
export function normalizedExpense(item) { const expenseType = item.expense_type || item.category || 'other'; return { ...item, expense_type: expenseType, category: item.expense_type ? item.category : categoryForExpenseType(expenseType) }; }
