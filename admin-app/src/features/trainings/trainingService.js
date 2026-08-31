import { supabase } from '../../lib/supabase.js';
import { fetchCompaniesForSelect } from '../clients/clientsService.js';
function fail(error) { if (error) throw error; }
export async function fetchTrainings() { const { data, error } = await supabase.from('training_engagements').select('*,companies(name)').order('starts_at', { ascending: true, nullsFirst: false }); fail(error); return data || []; }
export async function fetchTrainingDetail(id) { const { data, error } = await supabase.from('training_engagements').select('*,companies(name)').eq('id', id).single(); fail(error); return data; }
export async function createTraining(values) { const { data, error } = await supabase.from('training_engagements').insert(values).select().single(); fail(error); return data; }
export async function updateTraining(id, values) { const { data, error } = await supabase.from('training_engagements').update(values).eq('id', id).select().single(); fail(error); return data; }
export async function listTrainingCompanies() { return fetchCompaniesForSelect(); }
