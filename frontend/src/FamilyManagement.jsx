
import React, { useEffect, useState } from 'react';
import { apiFetch } from './authService';
import './FamilyManagement.css';

const API = import.meta.env.VITE_API_BASE_URL
  || 'http://localhost:3000';

export default function FamilyManagement({ persons = [] }) {
  const [families, setFamilies] = useState([]);
  const [name, setName] = useState('');
  const [emails, setEmails] = useState(['']);
  const [memberIds, setMemberIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadFamilies() {
    try {
      const response = await apiFetch(`${API}/api/families`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Laden fehlgeschlagen');
      }

      setFamilies(result.data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadFamilies();
  }, []);

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

      <div className="family-cards">
        {families.map(family => (
          <div className="family-card" key={family.id}>
            <h3>{family.name}</h3>

            <strong>Familienmitglieder</strong>
            <p>
              {family.members?.map(m => m.fullName).join(', ')
                || 'Keine Mitglieder'}
            </p>

            <strong>Login-E-Mails</strong>
            <p>{family.emails?.join(', ') || 'Keine E-Mail'}</p>
          </div>
        ))}

        {!families.length && (
          <p>Es wurden noch keine Familien angelegt.</p>
        )}
      </div>
    </div>
  );
}
