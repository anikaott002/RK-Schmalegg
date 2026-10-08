
import React, { useEffect, useState } from 'react';
import { apiFetch } from './authService';
import './FamilyManagement.css';

const API = import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:3000';

export default function FamilyManagement({
  persons = [],
  selectedYear = new Date().getFullYear()
}) {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [emails, setEmails] = useState(['']);
  const [memberIds, setMemberIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  
  async function loadFamilies() {
    try {
      setLoading(true);
      setError('');

      const response = await apiFetch(
        `${API}/api/families?year=${selectedYear}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Familien konnten nicht geladen werden.'
        );
      }

      setFamilies(result.data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Familien:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    loadFamilies();
  }, [selectedYear]);

  const toggleMember = id => {
    setMemberIds(previous =>
      previous.includes(id)
        ? previous.filter(value => value !== id)
        : [...previous, id]
    );
  };

  const addEmail = () => setEmails([...emails, '']);

  const changeEmail = (index, value) => {
    setEmails(previous =>
      previous.map((email, i) => i === index ? value : email)
    );
  };

  async function saveFamily(event) {
    event.preventDefault();
    setError('');

    const cleanEmails = emails
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);

    if (!name.trim() || !cleanEmails.length || !memberIds.length) {
      setError('Bitte Familienname, E-Mail und Mitglieder angeben.');
      return;
    }

    if (new Set(cleanEmails).size !== cleanEmails.length) {
      setError('Eine E-Mail wurde mehrfach angegeben.');
      return;
    }

    setSaving(true);

    try {
      const response = await apiFetch(`${API}/api/families`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          emails: cleanEmails,
          personIds: memberIds
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Speichern fehlgeschlagen');
      }

      setName('');
      setEmails(['']);
      setMemberIds([]);
      setShowForm(false);
      await loadFamilies();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const assignedIds = new Set(
    families.flatMap(family =>
      (family.members || []).map(member => Number(member.id))
    )
  );

  return (
    <div className="family-management">
      <div className="family-header">
        <h3>Familienverwaltung</h3>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Abbrechen' : '+ Familie hinzufügen'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form className="family-form" onSubmit={saveFamily}>
          <h3>Neue Familie anlegen</h3>

          <label htmlFor="family-name">Familienname</label>
          <input
            id="family-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. Familie Mayer"
            required
          />

          <h4>Login-E-Mail-Adressen</h4>
          {emails.map((email, index) => (
            <div className="family-email-row" key={index}>
              <input
                type="email"
                value={email}
                onChange={e => changeEmail(index, e.target.value)}
                placeholder="E-Mail-Adresse"
                required={index === 0}
              />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setEmails(emails.filter((_, i) => i !== index))
                  }
                >
                  Entfernen
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addEmail}>
            + Weitere E-Mail
          </button>

          <h4>Familienmitglieder auswählen</h4>
          <div className="family-member-list">
            {persons.filter(person =>
              !assignedIds.has(Number(person.id))
            ).map(person => (
              <label key={person.id}>
                <input
                  type="checkbox"
                  checked={memberIds.includes(person.id)}
                  onChange={() => toggleMember(person.id)}
                />
                <span>{person.fullName}</span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Speichern...' : 'Familie speichern'}
          </button>
        </form>
      )}
      
      <div className="persons-table family-table">
        {loading ? (
          <div className="no-data">
            Familien werden geladen...
          </div>
        ) : error ? null : families.length === 0 ? (
          <div className="no-data">
            Es wurden noch keine Familien angelegt.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Familie</th>
                <th>E-Mail</th>
                <th>Telefon</th>
                <th>Geleistete Stunden</th>
              </tr>
            </thead>
            <tbody>
              {families.map(family => (
                <tr key={family.id}>
                  <td>
                    <strong>{family.name}</strong>
                  </td>
                  <td>
                    {(family.emails || []).map(email => (
                      <div key={email}>{email}</div>
                    ))}
                  </td>
                  <td>
                    {(family.phones || []).map(phone => (
                      <div key={phone}>{phone}</div>
                    ))}
                  </td>
                  <td>
                    {family.totalHours || 0} h
                  </td>
                </tr>
              ))}
            </tbody>
          
          </table>
        )}
      </div>

      {!loading && !error && (
        <div className="persons-stats">
          <div className="stat-item">
            <span className="stat-number">
              {families.length}
            </span>
            <span className="stat-label">
              {families.length === 1
                ? 'Familie in der aktuellen Ansicht'
                : 'Familien in der aktuellen Ansicht'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}




