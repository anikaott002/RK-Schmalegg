import React, { useState, useEffect } from 'react';
import FamilyManagement from './FamilyManagement';
import './PersonsTable.css';
import { apiFetch } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const PersonsTable = () => {
  const [persons, setPersons] = useState([]);
  
  const [families, setFamilies] = useState([]);
  const [listFilter, setListFilter] = useState('all');
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [familiesError, setFamiliesError] = useState('');

  const [activeTab, setActiveTab] = useState('persons');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    new Date().getFullYear()
  );
  const [latestEventYear, setLatestEventYear] = useState(
    new Date().getFullYear()
  );
  const [newPerson, setNewPerson] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  
useEffect(() => {
  fetchPersons();
  fetchFamilies();
}, [selectedYear]);

useEffect(() => {
  fetchEventYears();
}, [activeTab]);


  const fetchPersons = async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`${API_BASE_URL}/api/persons?year=${selectedYear}`);
      const result = await response.json();
      
      if (result.success) {
        setPersons(result.data);
      } else {
        setError(result.message || 'Fehler beim Laden der Personen');
      }
    } catch (error) {
      setError('Verbindungsfehler');
      console.error('Error fetching persons:', error);
    } finally {
      setLoading(false);
    }
  };

  
const fetchFamilies = async () => {
  try {
    setFamiliesLoading(true);
    setFamiliesError('');

    const response = await apiFetch(
      `${API_BASE_URL}/api/families?year=${selectedYear}`
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || 'Familien konnten nicht geladen werden'
      );
    }

    setFamilies(result.data || []);

  } catch (error) {
    console.error('Fehler beim Laden der Familien:', error);
    setFamiliesError(error.message);
  } finally {
    setFamiliesLoading(false);
  }
};


const fetchEventYears = async () => {
  try {
    const response = await apiFetch(
      `${API_BASE_URL}/api/events`
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error('Event-Jahre konnten nicht geladen werden');
    }

    const currentYear = new Date().getFullYear();
    let maxYear = currentYear;

    (result.data || []).forEach(event => {
      const dates = [
        event.dateFrom,
        event.dateTo,
        ...(event.timeSlots || []).map(slot => slot.date)
      ];

      dates.forEach(date => {
        if (!date) return;

        const year = Number(String(date).slice(0, 4));

        if (
          Number.isInteger(year) &&
          year >= 2000 &&
          year <= 2100
        ) {
          maxYear = Math.max(maxYear, year);
        }
      });
    });

    setLatestEventYear(maxYear);

  } catch (error) {
    console.error('Fehler beim Laden der Event-Jahre:', error);
  }
};



  const handleAddPerson = async () => {
    if (!newPerson.firstName.trim() || !newPerson.lastName.trim()) {
      setError('Vor- und Nachname sind erforderlich');
      return;
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/persons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPerson)
      });

      const result = await response.json();
      
      if (result.success) {
        setPersons([...persons, result.data]);
        setNewPerson({ firstName: '', lastName: '', email: '', phone: '' });
        setShowAddForm(false);
        setError('');
      } else {
        setError(result.message || 'Fehler beim Erstellen der Person');
      }
    } catch (error) {
      setError('Verbindungsfehler');
      console.error('Error creating person:', error);
    }
  };


  const handleExportCSV = () => {
    if (!canExport) {
      alert('Bitte warten, bis die Familien geladen sind.');
      return;
    }

    // CSV-Spalten ohne ID
    const headers = [
      'Name',
      'E-Mail',
      'Telefon',
      'Geleistete Stunden'
    ];

    // Daten aus dem aktuell ausgewählten Filter
    const rows = filteredRows.map(row => [
      row.name,
      row.emails.join(' / '),
      row.phones.join(' / '),
      row.totalHours
    ]);

    // Gesamtstunden ergänzen
    rows.push([
      'Gesamtstunden',
      '',
      '',
      totalDisplayedHours
    ]);

    // Schutz vor CSV-Formel-Injection
    const escapeCSV = value => {
      const raw = String(value ?? '');
      const safe = /^[\s]*[=+\-@\t\r]/.test(raw)
        ? `'${raw}`
        : raw;

      return `"${safe.replace(/"/g, '""')}"`;
    };

    // CSV erstellen
    const csvContent = [
      headers.map(escapeCSV).join(';'),
      ...rows.map(row =>
        row.map(escapeCSV).join(';')
      )
    ].join('\r\n');

    // Datei herunterladen
    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `Mitglieder_${selectedYear}_${listFilter}_${new Date().toISOString().split('T')[0]}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };


  
const handlePrint = () => {
  if (!canExport) {
    alert('Bitte warten, bis die Familien geladen sind.');
    return;
  }

  const escapeHTML = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));

  const filterNames = {
    all: 'Alle Personen einzeln',
    standalone: 'Personen ohne Familie',
    families: 'Familien',
    combined: 'Familien und Einzelpersonen'
  };

  const tableRows = filteredRows.map(row => `
    <tr>
      <td>${escapeHTML(row.name)}</td>
      <td>${row.emails.map(escapeHTML).join('<br>')}</td>
      <td>${row.phones.map(escapeHTML).join('<br>')}</td>
      <td>${escapeHTML(row.totalHours)} h</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="de">
    <head>
      <meta charset="UTF-8">
      <title>Arbeitsstunden ${selectedYear}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          color: #222;
          padding: 24px;
        }
        h1 { font-size: 22px; }
        p { color: #555; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 22px;
          font-size: 12px;
        }
        th, td {
          padding: 10px;
          border-bottom: 1px solid #ddd;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
        }
        th {
          background: #f1f1f1;
        }
        tfoot td {
          font-weight: bold;
          border-top: 2px solid #333;
        }
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
      </style>
    </head>
    <body>
      <h1>RK Schmalegg – Arbeitsstunden</h1>
      <p>
        Jahr: ${selectedYear}<br>
        Ansicht: ${escapeHTML(filterNames[listFilter])}
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>E-Mail</th>
            <th>Telefon</th>
            <th>Geleistete Stunden</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Gesamtstunden</td>
            <td>${totalDisplayedHours} h</td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    alert('Bitte Pop-ups für diese Website erlauben.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};


 // Dynamische Jahresauswahl: 5 Jahre zurück + zukünftige Event-Jahre
const currentYear = new Date().getFullYear();

const firstYear = currentYear - 5;
const lastYear = Math.max(currentYear, latestEventYear);

const yearOptions = [];

for (let year = lastYear; year >= firstYear; year--) {
  yearOptions.push(year);
}

  
// Personen, die einer Familie zugeordnet sind
const familyMemberIds = new Set(
  families.flatMap(family =>
    (family.members || []).map(member => String(member.id))
  )
);

// Personen ohne Familienzuordnung
const standalonePersons = persons.filter(
  person => !familyMemberIds.has(String(person.id))
);

// Normale Personenzeilen
const createPersonRows = list => list.map(person => ({
  key: `person-${person.id}`,
  type: 'person',
  name: person.fullName,
  emails: person.email ? [person.email] : [],
  phones: person.phone ? [person.phone] : [],
  totalHours: Number(person.totalHours || 0)
}));

// Familienzeilen mit zusammengefassten Stunden
const familyRows = families.map(family => ({
  key: `family-${family.id}`,
  type: 'family',
  name: family.name,
  emails: family.emails || [],
  phones: family.phones || [],
  totalHours: Number(family.totalHours || 0)
}));

let filteredRows = [];

switch (listFilter) {
  case 'standalone':
    filteredRows = createPersonRows(standalonePersons);
    break;

  case 'families':
    filteredRows = familyRows;
    break;

  case 'combined':
    filteredRows = [
      ...familyRows,
      ...createPersonRows(standalonePersons)
    ];
    break;

  default:
    filteredRows = createPersonRows(persons);
}

filteredRows.sort((a, b) =>
  a.name.localeCompare(b.name, 'de')
);

const totalDisplayedHours = Math.round(
  filteredRows.reduce(
    (sum, row) => sum + row.totalHours,
    0
  ) * 10
) / 10;

const needsFamilyData = listFilter !== 'all';
const familyDataReady = !familiesLoading && !familiesError;
const canExport = !needsFamilyData || familyDataReady;

  if (loading) {
    return <div className="loading">Lade Personen...</div>;
  }

  return (
    <div className="persons-table-container">
      <div className="persons-header">
        <h2>Personen Verwaltung</h2>
        <div className="header-controls">
          <div className="year-filter">
            <label htmlFor="year-select">Jahr:</label>
            <select 
              id="year-select"
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="year-select"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="header-buttons">
            <button 
              className="btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              + Person hinzufügen
            </button>
            <button 
              className="btn-secondary"
              onClick={() => alert('Excel-Import wird noch implementiert')}
            >
              📊 Excel importieren
            </button>
            <button 
              className="btn-secondary"
              onClick={handleExportCSV}
            >
              📥 CSV exportieren
            </button>
            
            <button
              className="btn-secondary"
              onClick={handlePrint}
              disabled={!canExport}
            >
              🖨️ PDF / Drucken
            </button>

          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      <div className="members-filter">
        <label htmlFor="members-list-filter">
          Ansicht:
        </label>

        <select
          id="members-list-filter"
          value={listFilter}
          onChange={e => setListFilter(e.target.value)}
        >
          <option value="all">
            Alle Personen einzeln
          </option>

          <option value="standalone">
            Nur Personen ohne Familie
          </option>

          <option value="families">
            Nur Familien (Stunden summiert)
          </option>

          <option value="combined">
            Familien + Personen ohne Familie
          </option>
        </select>
      </div>

      {familiesError && (
        <div className="error-message">
          Familien konnten nicht geladen werden:
          {' '}{familiesError}
        </div>
      )}

      
      <div className="persons-view-tabs">
        <button
          className={activeTab === 'persons'
            ? 'btn-primary'
            : 'btn-secondary'}
          onClick={() => setActiveTab('persons')}
        >
          Einzelpersonen
        </button>

        <button
          className={activeTab === 'families'
            ? 'btn-primary'
            : 'btn-secondary'}
          onClick={() => setActiveTab('families')}
        >
          Familien
        </button>
      </div>

      {activeTab === 'families' && (
        <FamilyManagement
          persons={persons}
          selectedYear={selectedYear}
        />
      )}

      {activeTab === 'persons' && (
        <>
      {showAddForm && (
        <div className="add-person-form">
          <h3>Neue Person hinzufügen</h3>
          <div className="form-row">
            <input
              type="text"
              placeholder="Vorname*"
              value={newPerson.firstName}
              onChange={(e) => setNewPerson({...newPerson, firstName: e.target.value})}
            />
            <input
              type="text"
              placeholder="Nachname*"
              value={newPerson.lastName}
              onChange={(e) => setNewPerson({...newPerson, lastName: e.target.value})}
            />
          </div>
          <div className="form-row">
            <input
              type="email"
              placeholder="E-Mail (optional)"
              value={newPerson.email}
              onChange={(e) => setNewPerson({...newPerson, email: e.target.value})}
            />
            <input
              type="text"
              placeholder="Telefon (optional)"
              value={newPerson.phone}
              onChange={(e) => setNewPerson({...newPerson, phone: e.target.value})}
            />
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleAddPerson}>
              Hinzufügen
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setShowAddForm(false);
                setNewPerson({ firstName: '', lastName: '', email: '', phone: '' });
                setError('');
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      
      <div className="persons-table">
        {needsFamilyData && !familyDataReady ? (
          <div className="no-data">
            {familiesError
              ? 'Familienansicht momentan nicht verfügbar.'
              : 'Familien werden geladen...'}
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Telefon</th>
                  <th>Geleistete Stunden</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map(row => (
                  <tr key={row.key}>
                    <td>
                      <div className="person-name">
                        <strong>{row.name}</strong>
                      </div>
                    </td>

                    <td>
                      {row.emails.length
                        ? row.emails.map(email => (
                            <div className="family-contact" key={email}>
                              {email}
                            </div>
                          ))
                        : '–'}
                    </td>

                    <td>
                      {row.phones.length
                        ? row.phones.map(phone => (
                            <div className="family-contact" key={phone}>
                              {phone}
                            </div>
                          ))
                        : '–'}
                    </td>

                    <td className="hours-cell">
                      {row.totalHours} h
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <td colSpan="3">
                    <strong>Gesamtstunden</strong>
                  </td>
                  <td className="hours-cell">
                    <strong>{totalDisplayedHours} h</strong>
                  </td>
                </tr>
              </tfoot>
            </table>

            {filteredRows.length === 0 && (
              <div className="no-data">
                Keine Einträge für diesen Filter vorhanden.
              </div>
            )}
          </>
        )}
      </div>


      <div className="persons-stats">
        <div className="stat-item">
          <span className="stat-number">{filteredRows.length}</span>
          <span className="stat-label">Einträge in der aktuellen Ansicht</span>
        </div>
      </div>
      </>
      )}
    </div>
  );
};

export default PersonsTable;
