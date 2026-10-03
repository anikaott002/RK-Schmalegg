import express from 'express'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import * as dataService from './data.js'
import * as userService from './userManagement.js'
import { authClient, isAdminEmail, isAdminUser, optionalAuth, requireAdmin, requireAuth, requireAuthConfiguration } from './auth.js'

// === SECURITY UPDATE START: CORS + SECURITY HEADERS ===
const normalizeOrigin = value => String(value || '').trim().replace(/\/$/, '')

const allowedOrigins = new Set([
  normalizeOrigin(process.env.FRONTEND_URL),
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(normalizeOrigin),
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean))

const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header (e.g. server-to-server/health checks) are allowed.
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
      return callback(null, true)
    }
    console.warn(`CORS blockiert Origin: ${origin}`)
    return callback(new Error('CORS_ORIGIN_BLOCKED'))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}

const app = express()
// Vercel/Reverse-Proxy: echte Client-IP für Rate-Limiting korrekt auswerten.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  next()
})

app.use(cors(corsOptions))
app.use(express.json({ limit: '100kb' }))
// === SECURITY UPDATE END: CORS + SECURITY HEADERS === // Parse JSON request bodies

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Zu viele Versuche. Bitte später erneut versuchen.' },
})

function sanitizePublicEvent(event) {
  return {
    ...event,
    timeSlots: (event.timeSlots || []).map(slot => ({
      ...slot,
      participants: [],
    })),
  }
}

// Basic health check
app.get('/', async (req, res) => {
  res.json({ message: 'RK Schmalegg Eventmanager API Server läuft!' })
})

app.post('/api/auth/register', authRateLimit, requireAuthConfiguration, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'Bitte geben Sie eine gültige E-Mail-Adresse und ein Passwort mit mindestens 12 Zeichen ein.',
    })
  }

  try {
    const member = await userService.getPersonByEmail(email)
    if (!member && !isAdminEmail(email)) {
      return res.status(403).json({
        success: false,
        message: 'Registrierung nur mit einer hinterlegten Mitglieder- oder Admin-E-Mail möglich.',
      })
    }
    const { data, error } = await authClient.auth.signUp({ email, password })
        if (error) {
          console.error('Registrierung fehlgeschlagen:', error)

          let message = 'Registrierung nicht möglich.'

          if (error.code === 'user_already_exists' || error.code === 'email_exists') {
            message = 'Für diese E-Mail-Adresse existiert bereits ein Konto. Bitte melden Sie sich an.'
          } else if (error.code === 'weak_password') {
            message = 'Das Passwort erfüllt die Sicherheitsanforderungen nicht.'
          } else if (error.code === 'email_provider_disabled') {
            message = 'Die Registrierung per E-Mail ist in Supabase deaktiviert.'
          }

          return res.status(400).json({
            success: false,
            message,
          })
        }
    res.status(201).json({
    success: true,
    data: {
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
      },
      emailConfirmationRequired: false,
    },
    message: 'Registrierung erfolgreich',
    })
  } catch (error) {
    console.error('Registrierung fehlgeschlagen:', error)
    res.status(500).json({ success: false, message: 'Registrierung derzeit nicht möglich' })
  }
})

app.post('/api/auth/login', authRateLimit, requireAuthConfiguration, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password
  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'E-Mail und Passwort sind erforderlich.' })
  }

  try {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return res.status(401).json({ success: false, message: 'E-Mail oder Passwort ungültig.' })
    }
    res.json({
      success: true,
      data: {
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      },
    })
  } catch (error) {
    console.error('Anmeldung fehlgeschlagen:', error)
    res.status(503).json({ success: false, message: 'Anmeldung derzeit nicht möglich' })
  }
})

app.post('/api/auth/refresh', authRateLimit, requireAuthConfiguration, async (req, res) => {
  const refreshToken = req.body?.refreshToken
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh-Token fehlt.' })
  }

  try {
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) {
      return res.status(401).json({ success: false, message: 'Sitzung abgelaufen. Bitte erneut anmelden.' })
    }
    res.json({
      success: true,
      data: {
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        },
      },
    })
  } catch (error) {
    console.error('Sitzung konnte nicht erneuert werden:', error)
    res.status(503).json({ success: false, message: 'Sitzung kann derzeit nicht erneuert werden' })
  }
})

app.post('/api/auth/logout', requireAuthConfiguration, async (req, res) => {
  const accessToken = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const refreshToken = req.body?.refreshToken
  if (!accessToken || typeof refreshToken !== 'string' || !refreshToken) {
    return res.status(400).json({ success: false, message: 'Sitzungsdaten fehlen.' })
  }

  try {
    const { error: sessionError } = await authClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    if (sessionError) {
      return res.status(401).json({ success: false, message: 'Sitzung ist bereits ungültig.' })
    }
    const { error } = await authClient.auth.signOut({ scope: 'local' })
    if (error) throw error
    res.json({ success: true })
  } catch (error) {
    console.error('Abmeldung fehlgeschlagen:', error)
    res.status(503).json({ success: false, message: 'Abmeldung derzeit nicht möglich' })
  }
})

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const person = req.isAdmin ? null : await userService.getPersonByEmail(req.user.email)
    res.json({
      success: true,
      data: {
        email: req.user.email,
        isAdmin: isAdminUser(req.user),
        person,
      },
    })
  } catch (error) {
    console.error('Profil konnte nicht geladen werden:', error)
    res.status(500).json({ success: false, message: 'Profil konnte nicht geladen werden' })
  }
})

// Get all events (with optional status filter)
app.get('/api/events', optionalAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let events = await dataService.getAllEvents();
    
    if (!req.isAdmin) {
      events = events.filter(event => event.status === 'published');
      if (status && status !== 'published') events = [];
      events = events.map(sanitizePublicEvent);
    }

    // Filter by status if provided
    if (status) {
      events = events.filter(event => event.status === status);
    }
    
    res.json({
      success: true,
      data: events,
      totalEvents: events.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Events',
      error: error.message
    });
  }
});

// Get specific event by ID
app.get('/api/events/:id', optionalAuth, async (req, res) => {
  try {
    let event = await dataService.getEventById(req.params.id)
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      })
    }
    if (!req.isAdmin && event.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Event nicht gefunden' })
    }
    if (!req.isAdmin) event = sanitizePublicEvent(event)
    res.json({
      success: true,
      data: event
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden des Events',
      error: error.message
    })
  }
})

// Create new event
app.post('/api/events', requireAdmin, async (req, res) => {
  try {
    const newEvent = await dataService.createEvent(req.body)
    res.status(201).json({
      success: true,
      data: newEvent,
      message: 'Event erfolgreich erstellt'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Erstellen des Events',
      error: error.message
    })
  }
})

// Update existing event
app.put('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const updatedEvent = await dataService.updateEvent(req.params.id, req.body)
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      })
    }
    res.json({
      success: true,
      data: updatedEvent,
      message: 'Event erfolgreich aktualisiert'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Aktualisieren des Events',
      error: error.message
    })
  }
})

// Update event status (publish/unpublish)
app.put('/api/events/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['draft', 'published'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Ungültiger Status. Erlaubt sind: draft, published'
      });
    }

    const updatedEvent = await dataService.updateEvent(req.params.id, { status });
    if (!updatedEvent) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      });
    }

    res.json({
      success: true,
      data: updatedEvent,
      message: `Event ${status === 'published' ? 'veröffentlicht' : 'als Entwurf gespeichert'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Aktualisieren des Event-Status',
      error: error.message
    });
  }
});

// Delete event
app.delete('/api/events/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await dataService.deleteEvent(req.params.id)
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      })
    }
    res.json({
      success: true,
      message: 'Event erfolgreich gelöscht'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Löschen des Events',
      error: error.message
    })
  }
})

// User Management Endpoints

// Get all persons
app.get('/api/persons', requireAdmin, async (req, res) => {
  try {
    const { year } = req.query;
    const persons = await userService.getAllPersons(year ? parseInt(year) : null);
    res.json({
      success: true,
      data: persons,
      year: year || 'all'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Personen',
      error: error.message
    })
  }
})

// Get specific person by ID
app.get('/api/persons/:id', requireAuth, async (req, res) => {
  try {
    const person = await userService.getPersonById(req.params.id)
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Person nicht gefunden'
      })
    }
    if (!req.isAdmin && String(person.email || '').toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(404).json({ success: false, message: 'Person nicht gefunden' })
    }
    res.json({
      success: true,
      data: person
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Person',
      error: error.message
    })
  }
})

// Create new person
app.post('/api/persons', requireAdmin, async (req, res) => {
  try {
    const newPerson = await userService.createPerson(req.body)
    res.status(201).json({
      success: true,
      data: newPerson,
      message: 'Person erfolgreich erstellt'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Erstellen der Person',
      error: error.message
    })
  }
})

// Import persons from array (overwrites all existing persons)
app.post('/api/persons/import', requireAdmin, async (req, res) => {
  try {
    const { persons } = req.body;
    
    if (!persons || !Array.isArray(persons)) {
      return res.status(400).json({
        success: false,
        message: 'Import-Daten müssen ein Array von Personen enthalten'
      });
    }

    const importedPersons = await userService.importPersons(persons);
    
    res.json({
      success: true,
      data: importedPersons,
      message: `${importedPersons.length} Personen erfolgreich importiert`,
      count: importedPersons.length
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Importieren der Personen',
      error: error.message
    });
  }
})

// Time Slot Management API Routes

// Get all time slots for an event
app.get('/api/events/:eventId/timeslots', optionalAuth, async (req, res) => {
  try {
    const event = await dataService.getEventById(req.params.eventId)
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      })
    }
    if (!req.isAdmin && event.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Event nicht gefunden' })
    }
    res.json({
      success: true,
      data: req.isAdmin ? event.timeSlots || [] : (event.timeSlots || []).map(slot => ({
        ...slot,
        participants: [],
      })),
      eventId: event.id
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Fehler beim Laden der Time Slots',
      error: error.message
    })
  }
})

// Add time slot to event
app.post('/api/events/:eventId/timeslots', requireAdmin, async (req, res) => {
  try {
    const timeSlot = await dataService.addTimeSlot(req.params.eventId, req.body)
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Event nicht gefunden'
      })
    }
    res.json({
      success: true,
      data: timeSlot,
      message: 'Time Slot erfolgreich erstellt'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Erstellen des Time Slots',
      error: error.message
    })
  }
})

// Update time slot
app.put('/api/events/:eventId/timeslots/:timeSlotId', requireAdmin, async (req, res) => {
  try {
    const timeSlot = await dataService.updateTimeSlot(req.params.eventId, req.params.timeSlotId, req.body)
    if (!timeSlot) {
      return res.status(404).json({
        success: false,
        message: 'Time Slot nicht gefunden'
      })
    }
    res.json({
      success: true,
      data: timeSlot,
      message: 'Time Slot erfolgreich aktualisiert'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Aktualisieren des Time Slots',
      error: error.message
    })
  }
})

// Delete time slot
app.delete('/api/events/:eventId/timeslots/:timeSlotId', requireAdmin, async (req, res) => {
  try {
    const success = await dataService.deleteTimeSlot(req.params.eventId, req.params.timeSlotId)
    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Time Slot nicht gefunden'
      })
    }
    res.json({
      success: true,
      message: 'Time Slot erfolgreich gelöscht'
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Löschen des Time Slots',
      error: error.message
    })
  }
})

// Get time slot participation
app.get('/api/events/:eventId/timeslots/:timeSlotId/participation', requireAuth, async (req, res) => {
  try {
    const event = await dataService.getEventById(req.params.eventId)
    if (!event || (!req.isAdmin && event.status !== 'published')) {
      return res.status(404).json({ success: false, message: 'Event nicht gefunden' })
    }
    let participation = await dataService.getTimeSlotParticipation(req.params.eventId, req.params.timeSlotId)
    if (!req.isAdmin) {
      const person = await userService.getPersonByEmail(req.user.email)
      if (!person) return res.status(403).json({ success: false, message: 'Kein zugeordnetes Mitgliederprofil gefunden' })
      participation = participation.filter(entry => entry.person?.id === person.id)
    }
    res.json({
      success: true,
      data: participation
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Laden der Teilnahmedaten',
      error: error.message
    })
  }
})

// Manage time slot participation
app.post('/api/events/:eventId/timeslots/:timeSlotId/participation', requireAuth, async (req, res) => {
  try {
    const { status } = req.body
    let { personId } = req.body
    if (!req.isAdmin) {
      const event = await dataService.getEventById(req.params.eventId)
      if (!event || event.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Event nicht gefunden' })
      }
      const person = await userService.getPersonByEmail(req.user.email)
      if (!person) return res.status(403).json({ success: false, message: 'Kein zugeordnetes Mitgliederprofil gefunden' })
      personId = person.id
    }
    
    if (status === 'remove') {
      const success = await dataService.removeTimeSlotParticipation(req.params.eventId, req.params.timeSlotId, personId)
      if (success) {
        res.json({
          success: true,
          message: 'Teilnahme erfolgreich entfernt'
        })
      } else {
        res.status(404).json({
          success: false,
          message: 'Teilnahme nicht gefunden'
        })
      }
    } else {
      // Validate status - only 'accepted' is allowed, 'remove' is handled above
      const validStatuses = ['accepted'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Ungültiger Status. Erlaubte Werte: ${validStatuses.join(', ')}, oder 'remove' zum Entfernen`
        });
      }

      const participation = await dataService.setTimeSlotParticipation(req.params.eventId, req.params.timeSlotId, personId, status)
      if (participation) {
        res.json({
          success: true,
          data: participation,
          message: `Teilnahmestatus erfolgreich auf '${status}' gesetzt`
        })
      } else {
        res.status(400).json({
          success: false,
          message: 'Fehler beim Setzen des Teilnahmestatus'
        })
      }
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Fehler beim Verwalten der Teilnahme',
      error: error.message
    })
  }
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('API Endpoints:')
  console.log('  Events:')
  console.log('    GET    /api/events         - Alle Events abrufen')
  console.log('    GET    /api/events/:id     - Einzelnes Event abrufen')
  console.log('    POST   /api/events         - Neues Event erstellen')
  console.log('    PUT    /api/events/:id     - Event aktualisieren')
  console.log('    DELETE /api/events/:id     - Event löschen')
  console.log('  Persons:')
  console.log('    GET    /api/persons        - Alle Personen abrufen')
  console.log('    GET    /api/persons/:id    - Einzelne Person abrufen')
  console.log('    POST   /api/persons        - Neue Person erstellen')
  console.log('  Zeitslots:')
  console.log('    GET    /api/events/:eventId/timeslots                   - Zeitslots für Event abrufen')
  console.log('    POST   /api/events/:eventId/timeslots                   - Zeitslot erstellen')
  console.log('    PUT    /api/events/:eventId/timeslots/:timeSlotId      - Zeitslot aktualisieren')
  console.log('    DELETE /api/events/:eventId/timeslots/:timeSlotId      - Zeitslot löschen')
  console.log('  Zeitslot Teilnahme:')
  console.log('    GET    /api/events/:eventId/timeslots/:timeSlotId/participation - Zeitslot Teilnahmedaten abrufen')
  console.log('    POST   /api/events/:eventId/timeslots/:timeSlotId/participation - Zeitslot Teilnahme verwalten')
})