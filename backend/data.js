import { supabase } from './supabaseClient.js';
import * as userService from './userManagement.js';

function rowToPerson(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email || '',
    phone: row.phone || '',
    manualHours: Number(row.manual_hours || 0),
  };
}

function rowToTimeSlot(row) {
  const participants = (row.time_slot_participants || []).map(p => ({
    person: rowToPerson(p.persons),
    status: p.status,
  }));
  const acceptedCount = participants.filter(p => p.status === 'accepted').length;
  const maxParticipants = Number(row.max_participants || 0);
  return {
    id: Number(row.id),
    name: row.name,
    date: row.date,
    timeFrom: row.time_from ? String(row.time_from).slice(0, 5) : null,
    timeTo: row.time_to ? String(row.time_to).slice(0, 5) : null,
    maxParticipants,
    category: row.category || '',
    participants,
    availableSpots: Math.max(0, maxParticipants - acceptedCount),
    isFull: acceptedCount >= maxParticipants,
  };
}
// === CATEGORY UPDATE START: EVENT CATEGORY NORMALIZATION ===
function normalizeEventCategories(categories = []) {
  if (!Array.isArray(categories)) return [];

  const normalized = categories
    .map(category => String(category || '').trim())
    .filter(Boolean)
    .map(category => category.slice(0, 80));

  return [...new Map(
    normalized.map(category => [category.toLocaleLowerCase('de'), category])
  ).values()].sort((a, b) => a.localeCompare(b, 'de'));
}
// === CATEGORY UPDATE END: EVENT CATEGORY NORMALIZATION ===
function rowToEvent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    description: row.description || '',
    dateFrom: row.date_from,
    dateTo: row.date_to,
    timeFrom: row.time_from ? String(row.time_from).slice(0, 5) : null,
    timeTo: row.time_to ? String(row.time_to).slice(0, 5) : null,
    location: row.location || '',
    status: row.status,
    categories,
    participants: [],
    timeSlots: (row.time_slots || []).map(rowToTimeSlot),
  };
}

const eventSelect = `
  id, name, description, date_from, date_to, time_from, time_to, location, status,
  categories, time_slots (
    id, event_id, name, category, date, time_from, time_to, max_participants,
    time_slot_participants (
      status,
      persons (id, first_name, last_name, email, phone, manual_hours)
    )
  )
`;

function eventPayload(eventData) {
  return {
    name: eventData.name,
    description: eventData.description || '',
    date_from: eventData.dateFrom || null,
    date_to: eventData.dateTo || null,
    time_from: eventData.timeFrom || null,
    time_to: eventData.timeTo || null,
    location: eventData.location || '',
    status: eventData.status || 'draft',
    categories: normalizeEventCategories(eventData.categories),
  };
}

function timeSlotPayload(timeSlotData, eventId) {
  return {
    ...(eventId ? { event_id: Number(eventId) } : {}),
    name: timeSlotData.name,
    category: timeSlotData.category || '',
    date: timeSlotData.date || null,
    time_from: timeSlotData.timeFrom || null,
    time_to: timeSlotData.timeTo || null,
    max_participants: Number(timeSlotData.maxParticipants || 0),
  };
}

export async function getAllEvents() {
  const { data, error } = await supabase.from('events').select(eventSelect).order('date_from', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToEvent);
}

export async function getEventById(id) {
  const { data, error } = await supabase.from('events').select(eventSelect).eq('id', Number(id)).maybeSingle();
  if (error) throw error;
  return data ? rowToEvent(data) : null;
}

export async function createEvent(eventData) {
  if (normalizeEventCategories(eventData.categories).length === 0) {
    throw new Error('Mindestens eine Kategorie ist erforderlich');
  }
  const { data: event, error } = await supabase.from('events').insert(eventPayload(eventData)).select('id').single();
  if (error) throw error;

  if (Array.isArray(eventData.timeSlots) && eventData.timeSlots.length) {
    const slots = eventData.timeSlots.map(ts => timeSlotPayload(ts, event.id));
    const { error: slotError } = await supabase.from('time_slots').insert(slots);
    if (slotError) throw slotError;
  }
  return getEventById(event.id);
}

export async function updateEvent(id, eventData) {
  const existing = await getEventById(id);
  if (!existing) return null;

  if (Array.isArray(eventData.categories) && normalizeEventCategories(eventData.categories).length === 0) {
    throw new Error('Mindestens eine Kategorie ist erforderlich');
  }

  const merged = { ...existing, ...eventData };
  const { error } = await supabase.from('events').update(eventPayload(merged)).eq('id', Number(id));
  if (error) throw error;

  if (Array.isArray(eventData.timeSlots)) {
    const existingIds = eventData.timeSlots.filter(ts => Number(ts.id) > 0).map(ts => Number(ts.id));

    for (const ts of eventData.timeSlots) {
      if (Number(ts.id) > 0) {
        const { error: updateError } = await supabase
          .from('time_slots')
          .update(timeSlotPayload(ts))
          .eq('id', Number(ts.id))
          .eq('event_id', Number(id));
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('time_slots').insert(timeSlotPayload(ts, id));
        if (insertError) throw insertError;
      }
    }

    const { data: dbSlots, error: slotReadError } = await supabase.from('time_slots').select('id').eq('event_id', Number(id));
    if (slotReadError) throw slotReadError;
    const toDelete = (dbSlots || []).map(s => Number(s.id)).filter(slotId => !existingIds.includes(slotId));
    if (toDelete.length) {
      const { error: deleteError } = await supabase.from('time_slots').delete().in('id', toDelete).eq('event_id', Number(id));
      if (deleteError) throw deleteError;
    }
  }

  return getEventById(id);
}

export async function deleteEvent(id) {
  const { data, error } = await supabase.from('events').delete().eq('id', Number(id)).select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

export async function addTimeSlot(eventId, timeSlotData) {
  const { data, error } = await supabase.from('time_slots').insert(timeSlotPayload(timeSlotData, eventId)).select('id').single();
  if (error) throw error;
  return getTimeSlotById(eventId, data.id);
}

export async function updateTimeSlot(eventId, timeSlotId, timeSlotData) {
  const { data, error } = await supabase
    .from('time_slots')
    .update(timeSlotPayload(timeSlotData))
    .eq('id', Number(timeSlotId))
    .eq('event_id', Number(eventId))
    .select('id');
  if (error) throw error;
  if (!(data || []).length) return null;
  return getTimeSlotById(eventId, timeSlotId);
}

export async function deleteTimeSlot(eventId, timeSlotId) {
  const { data, error } = await supabase
    .from('time_slots')
    .delete()
    .eq('id', Number(timeSlotId))
    .eq('event_id', Number(eventId))
    .select('id');
  if (error) throw error;
  return (data || []).length > 0;
}

export async function getTimeSlotById(eventId, timeSlotId) {
  const { data, error } = await supabase
    .from('time_slots')
    .select(`id, event_id, name, category, date, time_from, time_to, max_participants,
      time_slot_participants (status, persons (id, first_name, last_name, email, phone, manual_hours))`)
    .eq('id', Number(timeSlotId))
    .eq('event_id', Number(eventId))
    .maybeSingle();
  if (error) throw error;
  return data ? rowToTimeSlot(data) : null;
}

export async function getTimeSlotParticipation(eventId, timeSlotId) {
  const slot = await getTimeSlotById(eventId, timeSlotId);
  if (!slot) throw new Error('Zeitslot nicht gefunden');
  return slot.participants;
}

// === SECURITY UPDATE START: ATOMIC TIMESLOT BOOKING ===
export async function setTimeSlotParticipation(eventId, timeSlotId, personId, status) {
  const person = await userService.getPersonById(personId);
  if (!person) throw new Error('Person nicht gefunden');

  // Die Kapazitätsprüfung und das Upsert passieren atomar in PostgreSQL.
  // Voraussetzung: SUPABASE_SECURITY_MIGRATION.sql einmalig im Supabase SQL Editor ausführen.
  const { error } = await supabase.rpc('set_time_slot_participation_secure', {
    p_event_id: Number(eventId),
    p_time_slot_id: Number(timeSlotId),
    p_person_id: Number(personId),
    p_status: status,
  });

  if (error) {
    const message = String(error.message || '');
    if (message.includes('Zeitslot ist bereits voll')) throw new Error('Zeitslot ist bereits voll');
    if (message.includes('Zeitslot nicht gefunden')) throw new Error('Zeitslot nicht gefunden');
    if (message.includes('Person nicht gefunden')) throw new Error('Person nicht gefunden');
    throw error;
  }

  return { person, status };
}
// === SECURITY UPDATE END: ATOMIC TIMESLOT BOOKING ===


export async function removeTimeSlotParticipation(eventId, timeSlotId, personId) {
  const slot = await getTimeSlotById(eventId, timeSlotId);
  if (!slot) throw new Error('Zeitslot nicht gefunden');

  const { data, error } = await supabase
    .from('time_slot_participants')
    .delete()
    .eq('time_slot_id', Number(timeSlotId))
    .eq('person_id', Number(personId))
    .select('person_id');
  if (error) throw error;
  return (data || []).length > 0;
}
