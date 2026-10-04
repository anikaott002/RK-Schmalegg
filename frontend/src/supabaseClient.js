import { createClient } from '@supabase/supabase-js'

// === PASSWORD RESET START: FRONTEND SUPABASE CLIENT ===

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: true,

            // Die Recovery-Session bleibt nur in diesem Browser-Tab.
            storage: window.sessionStorage,
          },
        }
      )
    : null

// === PASSWORD RESET END: FRONTEND SUPABASE CLIENT ===