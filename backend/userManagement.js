import { supabase } from './supabaseClient.js';


function calculateHours(timeFrom, timeTo) {
  if (!timeFrom || !timeTo) return 0;
  const [fromHour, fromMin] = String(timeFrom).split(':').map(Number);
  const [toHour, toMin] = String(timeTo).split(':').map(Number);
  return ((toHour * 60 + toMin) - (fromHour * 60 + fromMin)) / 60;
}

function rowToPerson(row, hours = null) {
  const result = {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email || '',
    phone: row.phone || '',
    manualHours: Number(row.manual_hours || 0),
  };
  if (hours) {
    result.totalHours = hours.totalHours;
    result.approvedHours = hours.approvedHours;
  }
  return result;
}

export async function calculatePersonHours(personId, year = null) {
  const { data: person, error: personError } = await supabase
    .from('persons')
    .select('manual_hours')
    .eq('id', Number(personId))
    .maybeSingle();
  if (personError) throw personError;

  const manualHours = !year && person ? Number(person.manual_hours || 0) : 0;
  const { data: participations, error } = await supabase
    .from('time_slot_participants')
    .select('status, time_slots(time_from, time_to, events(date_from))')
    .eq('person_id', Number(personId))
    .eq('status', 'accepted');
  if (error) throw error;

  let timeslotHours = 0;
  for (const p of participations || []) {
    const slot = p.time_slots;
    const event = slot?.events;
    if (!slot) continue;
    if (year && event?.date_from && new Date(event.date_from).getFullYear() !== Number(year)) continue;
    timeslotHours += calculateHours(slot.time_from, slot.time_to);
  }

  return {
    totalHours: Math.round((manualHours + timeslotHours) * 10) / 10,
    approvedHours: Math.round(timeslotHours * 10) / 10,
  };
}


export async function getAllPersons(year = null) {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .order('last_name')
    .order('first_name');

  if (error) throw error;

  const rows = data || [];
  const results = [];

  // Maximal 10 Personen gleichzeitig berechnen
  const BATCH_SIZE = 10;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const calculated = await Promise.all(
      batch.map(async row => {
        const hours = await calculatePersonHours(row.id, year);
        return rowToPerson(row, hours);
      })
    );

    results.push(...calculated);
  }

  return results;
}


export async function getPersonById(id) {
  const { data, error } = await supabase.from('persons').select('*').eq('id', Number(id)).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...rowToPerson(data), isAdmin: false };
}

export async function getPersonByEmail(email) {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('email', String(email).trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ? { ...rowToPerson(data), isAdmin: false } : null;
}

export async function createPerson(personData) {
  const firstName = String(personData.firstName || '').trim();
  const lastName = String(personData.lastName || '').trim();
  if (!firstName || !lastName) throw new Error('Vorname und Nachname sind erforderlich');

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email: personData.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@rk-schmalegg.de`,
    phone: personData.phone || '',
    manual_hours: Number(personData.manualHours ?? personData.hours ?? 0),
  };
  const { data, error } = await supabase.from('persons').insert(payload).select('*').single();
  if (error) throw error;
  return rowToPerson(data);
}

export async function importPersons(personsArray) {
  if (!Array.isArray(personsArray)) throw new Error('Import data must be an array');
  for (const p of personsArray) {
    if (!p.firstName || !p.lastName) throw new Error('Each person must have firstName and lastName');
  }

  const { error: deleteError } = await supabase.from('persons').delete().gte('id', 0);
  if (deleteError) throw deleteError;

  if (!personsArray.length) return [];
  const payload = personsArray.map(p => ({
    first_name: String(p.firstName).trim(),
    last_name: String(p.lastName).trim(),
    email: p.email || `${String(p.firstName).toLowerCase()}.${String(p.lastName).toLowerCase()}@rk-schmalegg.de`,
    phone: p.phone || '',
    manual_hours: Number(p.manualHours ?? p.hours ?? 0),
  }));
  const { data, error } = await supabase.from('persons').insert(payload).select('*');
  if (error) throw error;
  return (data || []).map(rowToPerson);
}

export default { getAllPersons, getPersonById, getPersonByEmail, createPerson, importPersons, calculatePersonHours };
