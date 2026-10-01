import React, { useState } from 'react';
import './UserLogin.css';
import { authenticate, getAuthenticatedUser } from './authService';

const LOGO_URL = 'https://tse4.mm.bing.net/th/id/OIP.UORK-u3V7UVpyTeEcb0y_QHaHa?rs=1&pid=ImgDetMain&o=7&rm=3';

const UserLogin = ({ onUserSelect }) => {
  const [registering, setRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  const handleInputChange = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setError('');
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      const result = await authenticate(registering ? 'register' : 'login', form);
      if (registering && result.emailConfirmationRequired) {
        setNotice(result.message);
        return;
      }

      const user = await getAuthenticatedUser();
      if (user.isAdmin) {
        onUserSelect({ id: 'admin', fullName: 'Administrator', isAdmin: true });
      } else if (user.person) {
        onUserSelect({ ...user.person, isAdmin: false });
      } else {
        setError('Für diese E-Mail-Adresse wurde kein Mitgliederprofil gefunden. Bitte wenden Sie sich an den Administrator.');
      }
    } catch (requestError) {
      setError(requestError.message || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setRegistering(previous => !previous);
    setError('');
    setNotice('');
  };

  return (
    <div className="user-login-container">
      <div className="login-box">
        <div className="login-header">
          <img src={LOGO_URL} alt="RK Schmalegg Logo" className="header-logo" />
          <h2>{registering ? 'Registrierung' : 'Anmeldung'}</h2>
        </div>
        <p className="login-subtitle">
          {registering ? 'Konto mit E-Mail-Adresse und Passwort erstellen' : 'Bitte melden Sie sich an'}
        </p>

        {error && <div className="error-message" role="alert">{error}</div>}
        {notice && <div className="success-message" role="status">{notice}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">E-Mail-Adresse:</label>
            <input
              type="email"
              id="email"
              value={form.email}
              onChange={event => handleInputChange('email', event.target.value)}
              placeholder="name@beispiel.de"
              className="login-input"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passwort:</label>
            <input
              type="password"
              id="password"
              value={form.password}
              onChange={event => handleInputChange('password', event.target.value)}
              placeholder={registering ? 'Mindestens 12 Zeichen' : 'Passwort'}
              className="login-input"
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 12 : undefined}
              maxLength={128}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Bitte warten...' : registering ? 'Konto erstellen' : 'Anmelden'}
          </button>
        </form>

        <button type="button" className="login-mode-button" onClick={toggleMode} disabled={loading}>
          {registering ? 'Bereits registriert? Anmelden' : 'Noch kein Konto? Registrieren'}
        </button>
      </div>
    </div>
  );
};

export default UserLogin;
