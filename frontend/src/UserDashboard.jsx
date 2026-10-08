import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { EventUtils } from './apiService';
import ParticipantsTable from './ParticipantsTable';
import { apiFetch, logout } from './authService';
import './UserDashboard.css';

const LOGO_URL = 'https://tse4.mm.bing.net/th/id/OIP.UORK-u3V7UVpyTeEcb0y_QHaHa?rs=1&pid=ImgDetMain&o=7&rm=3';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const UserDashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { userId, eventId } = useParams();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [timeSlotParticipation, setTimeSlotParticipation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const allowedPersons = user.allowedPersons?.length
    ? user.allowedPersons
    : [user];

  const [selectedPersonBySlot, setSelectedPersonBySlot] =
    useState({});
  const [pendingSlots, setPendingSlots] = useState({});

  const getSelectedPersonId = timeSlotId => {
    return selectedPersonBySlot[timeSlotId]
      ?? allowedPersons[0]?.id;
  };


  useEffect(() => {
    if (user && !user.isAdmin) {
      fetchEvents();
    }
  }, [user]);

  useEffect(() => {
    // Load specific event when eventId is in URL
    if (eventId && events.length > 0) {
      console.log('Looking for eventId:', eventId, 'type:', typeof eventId);
      console.log('Available events:', events.map(e => ({ id: e.id, type: typeof e.id, name: e.name })));
      
      // Try both string and number comparison since URL params are strings
      const event = events.find(e => e.id == eventId || e.id === eventId || String(e.id) === String(eventId));
      
      if (event) {
        console.log('Found event:', event);
        setSelectedEvent(event);
      } else {
        console.log('Event not found with ID:', eventId);
        setError('Event nicht gefunden');
        navigate(`/user/${userId}`);
      }
    } else {
      setSelectedEvent(null);
    }
  }, [eventId, events, userId, navigate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Only fetch published events for regular users
      const eventsResponse = await apiFetch(`${API_BASE_URL}/api/events?status=published`);
      const eventsResult = await eventsResponse.json();
      
      if (eventsResult.success) {
        setEvents(eventsResult.data);
        await fetchTimeSlotParticipation(eventsResult.data);
      } else {
        setError('Fehler beim Laden der Events');
      }
    } catch (error) {
      setError('Verbindungsfehler');
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Slots parallel laden, damit beim direkten Öffnen eines Events die Anzeige nicht
  // auf die Antworten aller anderen Events nacheinander warten muss.
  
const fetchTimeSlotParticipation = async (eventsList) => {
  const results = await Promise.all(
    eventsList.map(async event => {
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/api/events/${event.id}/my-timeslots`
        );

        if (!response.ok) {
          throw new Error('Zeitslots konnten nicht geladen werden');
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(
            result.message || 'Zeitslots konnten nicht geladen werden'
          );
        }

        return (result.data || []).map(timeSlot => {
          const participants = timeSlot.participants || [];

          const myParticipation = participants.find(p =>
            allowedPersons.some(person =>
              String(person.id) === String(p.person?.id)
            )
          );

          return {
            eventId: event.id,
            timeSlotId: timeSlot.id,
            timeSlot: {
              ...timeSlot,
              participants
            },
            participation: myParticipation || {
              status: 'not_responded'
            }
          };
        });

      } catch (error) {
        console.error(
          `Zeitslots für Event ${event.id}:`,
          error
        );
        return [];
      }
    })
  );

  setTimeSlotParticipation(results.flat());
};


  // Nach einer Anmeldung nur den betroffenen Slot neu abrufen, ohne die Eventseite
  // zu verlassen oder sämtliche anderen Events erneut zu laden.
   
  const refreshOneTimeSlot = async (eventId, timeSlotId) => {
    const response = await apiFetch(
      `${API_BASE_URL}/api/events/${eventId}/my-timeslots`
    );

    if (!response.ok) {
      throw new Error('Aktualisierung fehlgeschlagen');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error('Aktualisierung fehlgeschlagen');
    }

    const updatedEntries = (result.data || []).map(slot => {
      const participants = slot.participants || [];

      const myParticipation = participants.find(p =>
        allowedPersons.some(person =>
          String(person.id) === String(p.person?.id)
        )
      );

      return {
        eventId: Number(eventId),
        timeSlotId: slot.id,
        timeSlot: {
          ...slot,
          participants
        },
        participation: myParticipation || {
          status: 'not_responded'
        }
      };
    });

    setTimeSlotParticipation(previous => [
      ...previous.filter(
        entry => String(entry.eventId) !== String(eventId)
      ),
      ...updatedEntries
    ]);
  };

  //   const [slotsResponse, participationResponse] = await Promise.all([
  //     apiFetch(`${API_BASE_URL}/api/events/${eventId}/timeslots`),
  //     apiFetch(`${API_BASE_URL}/api/events/${eventId}/timeslots/${timeSlotId}/participation`)
  //   ]);
  //   if (!slotsResponse.ok || !participationResponse.ok) {
  //     throw new Error('Aktualisierung fehlgeschlagen');
  //   }
  //   const [slotsResult, participationResult] = await Promise.all([
  //     slotsResponse.json(), participationResponse.json()
  //   ]);
  //   if (!slotsResult.success || !participationResult.success) {
  //     throw new Error('Aktualisierung fehlgeschlagen');
  //   }
  //   const slot = (slotsResult.data || []).find(s => String(s.id) === String(timeSlotId));
  //   if (!slot) throw new Error('Zeitslot nicht gefunden');
  //   const participants = participationResult.data || [];
  //   const myParticipation = participants.find(p =>
  //     allowedPersons.some(person => String(person.id) === String(p.person?.id))
  //   );
  //   setTimeSlotParticipation(previous => {
  //     const nextEntry = {
  //       eventId,
  //       timeSlotId,
  //       timeSlot: { ...slot, participants },
  //       participation: myParticipation || { status: 'not_responded' }
  //     };
  //     const remaining = previous.filter(p =>
  //       !(String(p.eventId) === String(eventId) && String(p.timeSlotId) === String(timeSlotId))
  //     );
  //     return [...remaining, nextEntry];
  //   });
  // };

  const updateTimeSlotParticipation = async (
    eventId,
    timeSlotId,
    status,
    personId = getSelectedPersonId(timeSlotId)
  ) => {
    const pendingKey = `${eventId}:${timeSlotId}`;
    if (pendingSlots[pendingKey]) return;
    setPendingSlots(previous => ({ ...previous, [pendingKey]: true }));
    setError('');

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/events/${eventId}/timeslots/${timeSlotId}/participation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, status })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Teilnahme konnte nicht gespeichert werden');
      }

      // Direkt die erfolgreiche Antwort anzeigen, ohne einen weiteren GET abzuwarten.
      setTimeSlotParticipation(previous => previous.map(entry => {
        if (String(entry.eventId) !== String(eventId) || String(entry.timeSlotId) !== String(timeSlotId)) {
          return entry;
        }
        const oldParticipants = entry.timeSlot.participants || [];
        const remaining = oldParticipants.filter(item => String(item.person?.id) !== String(personId));
        const selectedPerson = allowedPersons.find(person => String(person.id) === String(personId));
        const participants = status === 'remove'
          ? remaining
          : [...remaining, { person: { id: personId, fullName: selectedPerson?.fullName || '' }, status: 'accepted' }];
        const oldSpots = Number(entry.timeSlot.availableSpots);
        const wasAccepted = oldParticipants.some(item => String(item.person?.id) === String(personId) && item.status === 'accepted');
        const change = status === 'remove' ? (wasAccepted ? 1 : 0) : (wasAccepted ? 0 : -1);
        const availableSpots = Number.isFinite(oldSpots) ? Math.max(0, oldSpots + change) : entry.timeSlot.availableSpots;
        return {
          ...entry,
          timeSlot: {
            ...entry.timeSlot,
            participants,
            availableSpots,
            isFull: Number.isFinite(Number(availableSpots)) && Number(entry.timeSlot.maxParticipants) > 0
              ? Number(availableSpots) <= 0
              : entry.timeSlot.isFull
          },
          participation: participants.find(item => allowedPersons.some(person => String(person.id) === String(item.person?.id))) || { status: 'not_responded' }
        };
      }));

      // Unabhängig von der Button-Anzeige den tatsächlichen Serverstand abgleichen.
      // Fehler beim Hintergrundabgleich ändern den bestätigten Anmeldestatus nicht.
      refreshOneTimeSlot(eventId, timeSlotId).catch(error => {
        console.error('Hintergrundaktualisierung fehlgeschlagen:', error);
      });
    } catch (error) {
      setError(error.message || 'Verbindungsfehler');
      console.error('Error updating timeslot participation:', error);
    } finally {
      setPendingSlots(previous => {
        const next = { ...previous };
        delete next[pendingKey];
        return next;
      });
    }
  };

  const getTimeSlotParticipation = (eventId, timeSlotId) => {
    const participation = timeSlotParticipation.find(
      p => p.eventId === eventId && p.timeSlotId === timeSlotId
    );
    return participation ? participation.participation : { status: 'not_responded' };
  };

  const getTimeSlotsForEvent = (eventId) => {
    return timeSlotParticipation
      .filter(p => p.eventId === eventId)
      .map(p => p.timeSlot);
  };

  const handleEventClick = (event) => {
    if (!event || !event.id) {
      setError('Event nicht gefunden');
      return;
    }
    console.log('Clicking event:', event.id, 'type:', typeof event.id);
    navigate(`/user/${userId}/events/${event.id}`);
  };

  const handleBackToList = () => {
    navigate(`/user/${userId}`);
  };

  const handleLogout = () => {
    logout().finally(() => navigate('/'));
  };

  const getAvailableYears = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]; // Nächstes Jahr, Dieses Jahr, Letztes Jahr, Vorletztes Jahr
  };

  const getFilteredEvents = () => {
    return events.filter(event => {
      const eventYear = new Date(event.dateFrom).getFullYear();
      return eventYear === selectedYear;
    });
  };

  // Determine current view based on URL
  const getCurrentView = () => {
    return eventId ? 'details' : 'list';
  };

  const currentView = getCurrentView();

  // If an event is selected (URL has eventId), show the detail view
  if (currentView === 'details') {
    if (!selectedEvent && !loading) {
      return (
        <div className="user-dashboard-background">
          <div className="user-dashboard">
            <div className="dashboard-header">
              <div className="user-info">
                <img src={LOGO_URL} alt="RK Schmalegg Logo" className="header-logo" />
                <h1>Willkommen, {user.fullName}!</h1>
              </div>
              <button className="logout-button" onClick={handleLogout}>
                Abmelden
              </button>
            </div>
            <div className="error-message">
              Event nicht gefunden
              <button className="back-button" onClick={handleBackToList}>
                ← Zurück zur Übersicht
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!selectedEvent && loading) {
      return (
        <div className="user-dashboard-background">
          <div className="user-dashboard">
            <div className="dashboard-header">
              <div className="user-info">
                <img src={LOGO_URL} alt="RK Schmalegg Logo" className="header-logo" />
                <h1>Willkommen, {user.fullName}!</h1>
              </div>
              <button className="logout-button" onClick={handleLogout}>
                Abmelden
              </button>
            </div>
            <div>Event wird geladen...</div>
          </div>
        </div>
      );
    }

    const eventTimeSlots = getTimeSlotsForEvent(selectedEvent.id);
    // === OWN PARTICIPATIONS FILTER START ===
// In der unteren Übersicht werden nur Zeitslots angezeigt,
// bei denen der aktuell angemeldete Benutzer selbst angemeldet ist.
const myParticipationTimeSlots = eventTimeSlots.filter(timeSlot =>
  (timeSlot.participants || []).some(
    participant =>
      participant.status === 'accepted' &&
      allowedPersons.some(person => String(person.id) === String(participant.person?.id))
  )
);
// === OWN PARTICIPATIONS FILTER END ===
    return (
      <div className="user-dashboard-background">
        <div className="user-dashboard">
        <div className="dashboard-header">
          <div className="user-info">
            <img src={LOGO_URL} alt="RK Schmalegg Logo" className="header-logo" />
            <h1>Willkommen, {user.fullName}!</h1>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Abmelden
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="event-details-container">
          <button className="back-button" onClick={handleBackToList}>
            ← Zurück zur Übersicht
          </button>

          <div className="event-card-detail">
            <h2>{selectedEvent.name}</h2>
            <div className="event-info">
              <div className="event-date">
                📅 {EventUtils.getDateRange(selectedEvent.dateFrom, selectedEvent.dateTo)}
              </div>
              <div className="event-location">
                📍 {selectedEvent.location}
              </div>
              <div className="event-description">
                {selectedEvent.description}
              </div>
            </div>
          </div>

          {/* Zeitslots zum Anmelden */}
          {eventTimeSlots.length > 0 && (
            <div className="timeslots-signup-section">
              {(() => {
                // First group by date, then by category
                const groupedByDate = eventTimeSlots.reduce((acc, timeSlot) => {
                  const date = timeSlot.date || 'Alle Tage';
                  if (!acc[date]) {
                    acc[date] = {};
                  }
                  const category = timeSlot.category || 'Ohne Kategorie';
                  if (!acc[date][category]) {
                    acc[date][category] = [];
                  }
                  acc[date][category].push(timeSlot);
                  return acc;
                }, {});

                // Sort dates ("Alle Tage" first, then chronologically)
                const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                  if (a === 'Alle Tage') return -1;
                  if (b === 'Alle Tage') return 1;
                  return a.localeCompare(b);
                });

                return sortedDates.map(date => {
                  const categories = groupedByDate[date];
                  const sortedCategories = Object.keys(categories).sort();

                  return (
                    <div key={date} className="timeslot-date-section">
                      <h3 className="date-header">
                        {date === 'Alle Tage' ? date : new Date(date).toLocaleDateString('de-DE', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </h3>
                      
                      {sortedCategories.map(category => {
                        const slots = categories[category];
                        
                        // Sort slots by time within each category
                        const sortedSlots = slots.sort((a, b) => {
                          return a.timeFrom.localeCompare(b.timeFrom);
                        });
                        
                        return (
                          <div key={category} className="timeslot-category-section">
                            <h4 className="category-header">{category}</h4>
                            <div className="timeslots-grid">
                              {sortedSlots.map((timeSlot) => {
                                
                              const isPending = Boolean(pendingSlots[`${selectedEvent.id}:${timeSlot.id}`]);
                              const selectedPersonId =
                                getSelectedPersonId(timeSlot.id);

                              const isSignedUp = (timeSlot.participants || []).some(
                                entry =>
                                  entry.status === 'accepted' &&
                                  String(entry.person?.id) === String(selectedPersonId)
                              );

                                const isFull = timeSlot.isFull;
                                const availableSpots = timeSlot.availableSpots;
                                
                                return (
                                  <div key={timeSlot.id} className={`timeslot-card ${isSignedUp ? 'signed-up' : ''} ${isFull && !isSignedUp ? 'full' : ''}`}>
                                    <div className="timeslot-header">
                                      <h5>{timeSlot.name}</h5>
                                      <span className="timeslot-time">
                                        {timeSlot.timeFrom} - {timeSlot.timeTo}
                                      </span>
                                    </div>
                                    
                                    <div className="timeslot-info">
                                      <div className="capacity-info">
                                        {timeSlot.maxParticipants > 0 && (
                                          <span className={`capacity ${isFull ? 'full' : ''}`}>
                                            {timeSlot.maxParticipants - availableSpots}/{timeSlot.maxParticipants} Plätze
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="timeslot-status">
                                        {isSignedUp ? (
                                          <span className="status-signed-up">✓ Angemeldet</span>
                                        ) : isFull ? (
                                          <span className="status-full">Ausgebucht</span>
                                        ) : (
                                          <span className="status-available">Verfügbar</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="timeslot-actions">
                                      
                                      {allowedPersons.length > 1 && (
                                        <div className="family-person-select">
                                          <label
                                            htmlFor={`person-select-${timeSlot.id}`}
                                          >
                                            Person auswählen:
                                          </label>

                                          <select
                                            id={`person-select-${timeSlot.id}`}
                                            value={getSelectedPersonId(timeSlot.id)}
                                            onChange={(e) =>
                                              setSelectedPersonBySlot(prev => ({
                                                ...prev,
                                                [timeSlot.id]: Number(e.target.value)
                                              }))
                                            }
                                          >
                                            {allowedPersons.map(person => (
                                              <option
                                                key={person.id}
                                                value={person.id}
                                              >
                                                {person.fullName}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      )}

                                      {isPending ? (
                                        <button type="button" className="btn-timeslot-signup" disabled>Wird gespeichert...</button>
                                      ) : isSignedUp ? (
                                        <button 
                                          className="btn-timeslot-cancel"
                                          onClick={() => updateTimeSlotParticipation(selectedEvent.id, timeSlot.id, 'remove')}
                                        >
                                          Abmelden
                                        </button>
                              ) : !isFull ? (
                                        <button 
                                          className="btn-timeslot-signup"
                                          onClick={() => updateTimeSlotParticipation(selectedEvent.id, timeSlot.id, 'accepted')}
                                        >
                                          Anmelden
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* === OWN PARTICIPATIONS TABLE START === */}
{myParticipationTimeSlots.length > 0 && (
  <ParticipantsTable
    timeSlots={myParticipationTimeSlots}
    dateFrom={selectedEvent.dateFrom}
    userMode={true}
  />
)}
{/* === OWN PARTICIPATIONS TABLE END === */}
        </div>
      </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-dashboard-background">
        <div className="user-dashboard">
          <div className="dashboard-header">
            <h1>Lade Dashboard...</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-dashboard-background">
      <div className="user-dashboard">
        <div className="dashboard-header">
          <div className="user-info">
            <img src={LOGO_URL} alt="RK Schmalegg Logo" className="header-logo" />
            <h1>Willkommen, {user.fullName}!</h1>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Abmelden
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Year Filter */}
        <div className="year-filter-section">
          <label htmlFor="user-year-select">Jahr:</label>
          <select 
            id="user-year-select"
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-select"
          >
            {getAvailableYears().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="events-grid">
          {getFilteredEvents().map((event) => {
            return (
              <div key={event.id} className="event-card" onClick={() => handleEventClick(event)}>
                <div className="event-header">
                  <h3>{event.name}</h3>
                </div>
                
                <div className="event-details">
                  <div className="event-date">
                    📅 {EventUtils.getDateRange(event.dateFrom, event.dateTo)}
                  </div>
                  <div className="event-location">
                    📍 {event.location}
                  </div>
                  <div className="event-description">
                    {event.description}
                  </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
    </div>
  );
};

export default UserDashboard;
