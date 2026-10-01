import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  : null;

const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminUser(user) {
  return Boolean(user?.email && isAdminEmail(user.email));
}

export function isAdminEmail(email) {
  return Boolean(email && adminEmails.has(email.toLowerCase()));
}

function authenticationUnavailable(res) {
  return res.status(503).json({
    success: false,
    message: 'Die Anmeldung ist nicht konfiguriert. SUPABASE_ANON_KEY fehlt.',
  });
}

async function verifyToken(req, res, token) {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user || !data.user.email_confirmed_at) {
      res.status(401).json({ success: false, message: 'Ungültige oder nicht bestätigte Anmeldung' });
      return false;
    }

    req.user = data.user;
    req.isAdmin = isAdminUser(data.user);
    return true;
  } catch (error) {
    console.error('Tokenprüfung fehlgeschlagen:', error);
    res.status(503).json({ success: false, message: 'Anmeldung kann derzeit nicht geprüft werden' });
    return false;
  }
}

export async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Anmeldung erforderlich' });
  }
  if (await verifyToken(req, res, match[1])) return next();
}

export async function optionalAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next();
  if (await verifyToken(req, res, match[1])) return next();
}

export function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!adminEmails.size) {
      return res.status(503).json({
        success: false,
        message: 'Es ist keine Admin-E-Mail konfiguriert. ADMIN_EMAILS muss gesetzt werden.',
      });
    }
    if (!req.isAdmin) {
      return res.status(403).json({ success: false, message: 'Adminrechte erforderlich' });
    }
    return next();
  });
}

export function requireAuthConfiguration(req, res, next) {
  if (!authClient) return authenticationUnavailable(res);
  return next();
}
