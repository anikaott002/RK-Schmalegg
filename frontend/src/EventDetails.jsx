import React, { useState } from 'react';
import EventCard from './EventCard';
import ParticipantsTable from './ParticipantsTable';
import './EventDetails.css';


// === SECURITY UPDATE START: HTML ESCAPING FOR PRINT/PDF EXPORT ===
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
// === SECURITY UPDATE END: HTML ESCAPING FOR PRINT/PDF EXPORT ===

const EventDetails = ({ event, onBack, onUpdate, onDelete, onManageTimeSlots, onEditTimeSlot, onManageParticipants }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleUpdateClick = () => {
    onUpdate(event);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete(event.id);
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleTimeSlotClick = (timeSlot) => {
    if (onEditTimeSlot) {
      onEditTimeSlot(event, timeSlot);
    }
  };

  const handleParticipantsClick = (timeSlot) => {
    if (onManageParticipants) {
      onManageParticipants(event, timeSlot);
    }
  };

  const handleExportPDF = () => {
    // Create printable content
    const printWindow = window.open('', '_blank');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Event: ${event.name}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 210mm;
            margin: 0 auto;
          }
          h1 { color: #333; border-bottom: 3px solid #f6ce38; padding-bottom: 10px; }
          h2 { color: #333; margin-top: 30px; }
          h3 { color: #333; margin-top: 20px; margin-bottom: 10px; }
          h4 { color: #333; background: #fff8dc; padding: 8px 12px; border-left: 4px solid #f6ce38; margin-top: 25px; margin-bottom: 15px; }
          .event-info { margin: 20px 0; }
          .event-info p { margin: 5px 0; }
          .category-section { margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #333; color: #f6ce38; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8f9fa; }
          .status-accepted { color: #27ae60; font-weight: bold; }
          .status-declined { color: #e74c3c; }
          .full-badge { background: #e74c3c; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
          .available-badge { background: #27ae60; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <h1>Event: ${event.name}</h1>
        
        <div class="event-info">
          <p><strong>Datum:</strong> ${event.dateFrom}${event.dateTo !== event.dateFrom ? ' bis ' + event.dateTo : ''}</p>
          <p><strong>Ort:</strong> ${event.location || 'Nicht angegeben'}</p>
          <p><strong>Beschreibung:</strong> ${event.description || 'Keine Beschreibung'}</p>
        </div>

        <h2>Zeitslots und Teilnehmer</h2>
        
        ${event.timeSlots && event.timeSlots.length > 0 ? (() => {
          // Group timeslots by date first, then by category
          const groupedByDate = event.timeSlots.reduce((acc, slot) => {
            const date = slot.date || event.dateFrom;
            if (!acc[date]) {
              acc[date] = {};
            }
            const category = slot.category || 'Ohne Kategorie';
            if (!acc[date][category]) {
              acc[date][category] = [];
            }
            acc[date][category].push(slot);
            return acc;
          }, {});

          // Sort dates and render
          const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
            return a.localeCompare(b);
          });

          return sortedDates.map(date => {
            const categoriesForDate = groupedByDate[date];
            const formattedDate = new Date(date).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            return `
              <h3 style="color: #333; margin-top: 30px; padding-bottom: 10px; border-bottom: 2px solid #f6ce38;">${formattedDate}</h3>
              ${Object.entries(categoriesForDate).sort(([a], [b]) => a.localeCompare(b)).map(([category, slots]) => {
                // Sort slots by time within each category
                const sortedSlots = slots.sort((a, b) => a.timeFrom.localeCompare(b.timeFrom));
                
                return `
                  <div class="category-section">
                    <h4>${category}</h4>
                    ${sortedSlots.map(slot => {
                      const acceptedParticipants = slot.participants?.filter(p => p.status === 'accepted') || [];
                      const isFull = acceptedParticipants.length >= slot.maxParticipants;
                      
                      return `
                        <h3 style="font-size: 16px;">${slot.name} (${slot.timeFrom} - ${slot.timeTo})</h3>
                        <p>
                          <strong>Belegung:</strong> ${acceptedParticipants.length} / ${slot.maxParticipants}
                          ${isFull ? '<span class="full-badge">Voll</span>' : `<span class="available-badge">${slot.maxParticipants - acceptedParticipants.length} frei</span>`}
                        </p>
                        
                        ${slot.participants && slot.participants.length > 0 ? `
                          <table>
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>E-Mail</th>
                                <th>Telefon</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${slot.participants.map(p => `
                                <tr>
                                  <td>${p.person?.fullName || p.person?.firstName + ' ' + p.person?.lastName || 'Unbekannt'}</td>
                                  <td>${p.person?.email || '-'}</td>
                                  <td>${p.person?.phone || '-'}</td>
                                  <td class="status-${p.status}">${p.status === 'accepted' ? '✓ Zugesagt' : '✗ Abgesagt'}</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        ` : '<p><em>Noch keine Teilnehmer eingetragen</em></p>'}
                      `;
                    }).join('')}
                  </div>
                `;
              }).join('')}
            `;
          }).join('');
        })() : '<p><em>Keine Zeitslots vorhanden</em></p>'}

        <div class="footer">
          <p>Exportiert am: ${new Date().toLocaleString('de-DE')}</p>
          <p>RK Schmalegg Eventmanager</p>
        </div>
      </body>
      </html>
    `;
    
 // === SECURITY UPDATE START: ONLY ESCAPED DYNAMIC DATA REACHES DOCUMENT.WRITE ===
    printWindow.document.write(html);
    // === SECURITY UPDATE END: ONLY ESCAPED DYNAMIC DATA REACHES DOCUMENT.WRITE ===
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // === WORKLIST PDF START: NAMES ONLY ===
const handleExportWorkListPDF = () => {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">

      <title>
        Arbeitsliste: ${escapeHtml(event.name)}
      </title>

      <style>
        @media print {
          @page {
            margin: 2cm;
          }
        }

        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
          color: #333;
        }

        h1 {
          color: #333;
          border-bottom: 3px solid #f6ce38;
          padding-bottom: 10px;
        }

        h2 {
          margin-top: 30px;
          color: #333;
        }

        h3 {
          margin-top: 25px;
          padding-bottom: 10px;
          border-bottom: 2px solid #f6ce38;
        }

        h4 {
          background: #fff8dc;
          border-left: 4px solid #f6ce38;
          padding: 8px 12px;
          margin-top: 25px;
        }

        .event-info {
          margin: 20px 0;
        }

        .event-info p {
          margin: 5px 0;
        }

        .timeslot-title {
          font-weight: bold;
          margin-top: 20px;
          margin-bottom: 8px;
        }

        .occupancy {
          margin-bottom: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0 25px;
        }

        th,
        td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }

        th {
          background: #333;
          color: #f6ce38;
        }

        tr:nth-child(even) {
          background: #f8f9fa;
        }

        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #7f8c8d;
        }
      </style>
    </head>

    <body>

      <h1>
        Arbeitsliste: ${escapeHtml(event.name)}
      </h1>

      <div class="event-info">

        <p>
          <strong>Datum:</strong>
          ${escapeHtml(event.dateFrom)}
          ${
            event.dateTo !== event.dateFrom
              ? ` bis ${escapeHtml(event.dateTo)}`
              : ''
          }
        </p>

        <p>
          <strong>Ort:</strong>
          ${escapeHtml(event.location || 'Nicht angegeben')}
        </p>

      </div>

      <h2>Arbeitsliste</h2>

      ${
        event.timeSlots && event.timeSlots.length > 0
          ? (() => {

              const groupedByDate =
                event.timeSlots.reduce((acc, slot) => {

                  const date =
                    slot.date || event.dateFrom;

                  const category =
                    slot.category || 'Ohne Kategorie';

                  if (!acc[date]) {
                    acc[date] = {};
                  }

                  if (!acc[date][category]) {
                    acc[date][category] = [];
                  }

                  acc[date][category].push(slot);

                  return acc;
                }, {});


              const sortedDates =
                Object.keys(groupedByDate)
                  .sort((a, b) =>
                    a.localeCompare(b)
                  );


              return sortedDates.map(date => {

                const formattedDate =
                  new Date(date)
                    .toLocaleDateString(
                      'de-DE',
                      {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }
                    );


                return `
                  <h3>
                    ${escapeHtml(formattedDate)}
                  </h3>

                  ${
                    Object.entries(
                      groupedByDate[date]
                    )
                    .sort(([a], [b]) =>
                      a.localeCompare(b)
                    )
                    .map(([category, slots]) => {

                      const sortedSlots =
                        [...slots].sort(
                          (a, b) =>
                            a.timeFrom.localeCompare(
                              b.timeFrom
                            )
                        );


                      return `
                        <h4>
                          ${escapeHtml(category)}
                        </h4>

                        ${
                          sortedSlots.map(slot => {

                            const acceptedParticipants =
                              (
                                slot.participants || []
                              ).filter(
                                participant =>
                                  participant.status ===
                                  'accepted'
                              );


                            return `
                              <div class="timeslot-title">
                                ${escapeHtml(slot.name)}
                                (
                                  ${escapeHtml(slot.timeFrom)}
                                  -
                                  ${escapeHtml(slot.timeTo)}
                                )
                              </div>

                              <div class="occupancy">
                                <strong>
                                  Angemeldet:
                                </strong>

                                ${acceptedParticipants.length}
                              </div>

                              ${
                                acceptedParticipants.length > 0
                                  ? `
                                    <table>
                                      <thead>
                                        <tr>
                                          <th>Name</th>
                                        </tr>
                                      </thead>

                                      <tbody>

                                        ${
                                          acceptedParticipants
                                            .map(participant => {

                                              const name =
                                                participant.person?.fullName ||
                                                `${participant.person?.firstName || ''} ${participant.person?.lastName || ''}`.trim() ||
                                                'Unbekannt';


                                              return `
                                                <tr>
                                                  <td>
                                                    ${escapeHtml(name)}
                                                  </td>
                                                </tr>
                                              `;
                                            })
                                            .join('')
                                        }

                                      </tbody>
                                    </table>
                                  `
                                  : `
                                    <p>
                                      <em>
                                        Noch keine Teilnehmer angemeldet
                                      </em>
                                    </p>
                                  `
                              }
                            `;
                          }).join('')
                        }
                      `;
                    })
                    .join('')
                  }
                `;
              }).join('');
            })()

          : '<p><em>Keine Zeitslots vorhanden</em></p>'
      }

      <div class="footer">
        <p>
          Exportiert am:
          ${escapeHtml(
            new Date().toLocaleString('de-DE')
          )}
        </p>

        <p>
          RK Schmalegg Eventmanager
        </p>
      </div>

    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.print();
  }, 250);
};
// === WORKLIST PDF END: NAMES ONLY ===

  if (!event) {
    return (
      <div className="event-details-page">
        <div className="event-details-header">
          <button className="back-button" onClick={onBack}>
            ← Zurück zur Übersicht
          </button>
          <h2>Event nicht gefunden</h2>
        </div>
        <p>Das angeforderte Event konnte nicht gefunden werden.</p>
      </div>
    );
  }

  return (
    <div className="event-details-page">
      <div className="event-details-header">
        <button className="back-button" onClick={onBack}>
          ← Zurück zur Übersicht
        </button>
        <div className="action-buttons">
          <button className="timeslots-button" onClick={onManageTimeSlots}>
            ⏰ Zeitslots verwalten
          </button>
          <button className="export-button" onClick={handleExportPDF}>
            📄 PDF exportieren
          </button>
          {/* === WORKLIST PDF BUTTON START === */}
          <button
            className="export-button"
            onClick={handleExportWorkListPDF}
          >
            📋 Arbeitsliste exportieren
          </button>
          {/* === WORKLIST PDF BUTTON END === */}
          <button className="update-button" onClick={handleUpdateClick}>
            ✏️ Bearbeiten
          </button>
          <button className="delete-button" onClick={handleDeleteClick}>
            🗑️ Löschen
          </button>
        </div>
      </div>
      
      <div className="event-details-content">
        <EventCard event={event} />
        
        {event.timeSlots && event.timeSlots.length > 0 && (
          <ParticipantsTable 
            timeSlots={event.timeSlots} 
            dateFrom={event.dateFrom} 
          />
        )}
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-dialog">
            <h3>Event löschen</h3>
            <p>Sind Sie sicher, dass Sie das Event "<strong>{event.name}</strong>" löschen möchten?</p>
            <p className="warning-text">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="confirmation-actions">
              <button className="cancel-confirm-button" onClick={handleCancelDelete}>
                Abbrechen
              </button>
              <button className="confirm-delete-button" onClick={handleConfirmDelete}>
                Löschen bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetails;
