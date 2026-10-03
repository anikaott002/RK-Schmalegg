const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const SESSION_KEY = 'rk-schmalegg-auth-session';

// === SECURITY UPDATE START: SESSION TIMEOUT + SAFE SESSION STORAGE ===
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 Minuten ohne Aktivität
const ABSOLUTE_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // spätestens nach 8 Stunden neu anmelden
const ACTIVITY_WRITE_THROTTLE_MS = 60 * 1000;

function readStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function isExpired(session, now = Date.now()) {
  if (!session?.accessToken || !session?.refreshToken) return true;
  const startedAt = Number(session.startedAt || 0);
  const lastActivityAt = Number(session.lastActivityAt || startedAt || 0);
  if (!startedAt || !lastActivityAt) return true;

  return (
    now - lastActivityAt > INACTIVITY_TIMEOUT_MS ||
    now - startedAt > ABSOLUTE_SESSION_TIMEOUT_MS
  );
}

function saveAuthSession(session, { preserveSessionStart = false } = {}) {
  if (!session?.accessToken || !session?.refreshToken) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }

  const previous = preserveSessionStart ? readStoredSession() : null;
  const now = Date.now();
  const storedSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    startedAt: previous?.startedAt || now,
    lastActivityAt: previous?.lastActivityAt || now,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(storedSession));
}

export function getAuthSession() {
  const session = readStoredSession();
  if (!session) return null;
  if (isExpired(session)) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export function markSessionActivity() {
  const session = readStoredSession();
  if (!session || isExpired(session)) return;

  const now = Date.now();
  if (now - Number(session.lastActivityAt || 0) < ACTIVITY_WRITE_THROTTLE_MS) return;
  session.lastActivityAt = now;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function revokeStoredSession(session) {
  if (!session?.accessToken || !session?.refreshToken) return;
  try {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    // Lokales Logout muss auch funktionieren, wenn das Backend gerade nicht erreichbar ist.
  }
}

async function expireSessionAndRedirect() {
  const session = readStoredSession();
  if (!session || !isExpired(session)) return false;

  sessionStorage.removeItem(SESSION_KEY);
  await revokeStoredSession(session);

  const publicPaths = ['/login', '/'];
  if (!publicPaths.includes(window.location.pathname)) {
    window.location.replace('/login?reason=session-expired');
  }
  return true;
}

export function initializeSessionSecurity() {
  const activityEvents = ['click', 'keydown', 'touchstart', 'pointerdown'];
  const activityHandler = () => markSessionActivity();

  activityEvents.forEach(eventName => {
    window.addEventListener(eventName, activityHandler, { passive: true });
  });

  const timer = window.setInterval(() => {
    expireSessionAndRedirect();
  }, 30 * 1000);

  // Direkt beim Start prüfen, z. B. wenn ein Tab lange im Hintergrund offen war.
  expireSessionAndRedirect();

  return () => {
    activityEvents.forEach(eventName => window.removeEventListener(eventName, activityHandler));
    window.clearInterval(timer);
  };
}

// === SECURITY UPDATE END: SESSION TIMEOUT + SAFE SESSION STORAGE ===

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
