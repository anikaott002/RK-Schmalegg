
import { supabase } from './supabaseClient.js';

const normalizeEmail = email =>
  String(email || '').trim().toLowerCase();

export async function getFamilyByEmail(email) {
  const normalized = normalizeEmail(email);

  const { data: login, error: loginError } = await supabase
    .from('family_logins')
    .select('family_id')
    .eq('email', normalized)
    .maybeSingle();

  if (loginError) throw loginError;
  if (!login) return null;

  const { data: family, error: familyError } = await supabase
    .from('family_accounts')
    .select('id, name')
    .eq('id', login.family_id)
    .single();

  if (familyError) throw familyError;

  const { data: memberships, error: memberError } =
    await supabase
      .from('family_members')
      .select('person_id')
      .eq('family_id', family.id);

  if (memberError) throw memberError;

  const personIds = memberships.map(m => m.person_id);

  let persons = [];

  if (personIds.length) {
    const { data, error } = await supabase
      .from('persons')
      .select('id, first_name, last_name')
      .in('id', personIds)
      .order('first_name');

    if (error) throw error;

    persons = (data || []).map(person => ({
      id: Number(person.id),
      firstName: person.first_name,
      lastName: person.last_name,
      fullName: `${person.first_name} ${person.last_name}`
    }));
  }

  return {
    id: family.id,
    name: family.name,
    persons
  };
}

export async function getAllowedPersons(email) {
  const family = await getFamilyByEmail(email);

  if (family) return family.persons;

  const { data, error } = await supabase
    .from('persons')
    .select('id, first_name, last_name')
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) throw error;
  if (!data) return [];

  return [{
    id: Number(data.id),
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: `${data.first_name} ${data.last_name}`
  }];
}

export async function canManagePerson(email, personId) {
  const persons = await getAllowedPersons(email);

  return persons.some(
    person => String(person.id) === String(personId)
  );
}
