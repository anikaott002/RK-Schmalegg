import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserDashboard from '../UserDashboard';
import { getAuthenticatedUser, logout } from '../authService';

const UserPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, [userId]);

  
const loadUser = async () => {
  try {
    setLoading(true);

    const authenticatedUser = await getAuthenticatedUser();

    const allowedPersons =
      authenticatedUser.allowedPersons || [];

    const hasAccess =
      !authenticatedUser.isAdmin &&
      allowedPersons.some(
        person => String(person.id) === String(userId)
      );

    if (hasAccess) {
      const person = authenticatedUser.person;

      setUser({
        ...person,
        isAdmin: false,
        family: authenticatedUser.family,
        allowedPersons,
        fullName:
          authenticatedUser.family?.name ||
          person.fullName
      });
    } else {
      navigate('/login');
    }
  } catch (error) {
    console.error('Error loading user:', error);
    navigate('/login');
  } finally {
    setLoading(false);
  }
};


  const handleLogout = () => {
    logout().finally(() => navigate('/'));
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Lade Benutzerdaten...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Benutzer nicht gefunden</h2>
        <button 
          onClick={() => navigate('/login')}
          style={{
            background: '#f6ce38',
            color: '#333',
            border: '2px solid #e6be28',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease'
          }}
        >
          Zurück zur Anmeldung
        </button>
      </div>
    );
  }

  return <UserDashboard user={user} onLogout={handleLogout} />;
};

export default UserPage;
