const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const SESSION_KEY = 'rk-schmalegg-auth-session';

export function getAuthSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  if (session?.accessToken && session?.refreshToken) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export async function refreshAuthSession() {
  const session = getAuthSession();
  if (!session?.refreshToken) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    saveAuthSession(null);
    return null;
  }
  saveAuthSession(result.data.session);
  return result.data.session;
}

export async function apiFetch(url, options = {}) {
  const session = getAuthSession();
  const headers = new Headers(options.headers || {});
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  let response = await fetch(url, { ...options, headers });
  if (response.status !== 401 || !session?.refreshToken || url.includes('/api/auth/')) return response;

  const refreshed = await refreshAuthSession();
  if (!refreshed) return response;
  headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
  response = await fetch(url, { ...options, headers });
  return response;
}

export async function authenticate(endpoint, credentials) {
  const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Anmeldung fehlgeschlagen');
  }
  if (result.data.session) saveAuthSession(result.data.session);
  return result.data;
}

export async function getAuthenticatedUser() {
  const response = await apiFetch(`${API_BASE_URL}/api/auth/me`);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Anmeldung erforderlich');
  }
  return result.data;
}

export async function logout() {
  const session = getAuthSession();
  try {
    if (session?.accessToken && session?.refreshToken) {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    }
  } finally {
    saveAuthSession(null);
  }
}
