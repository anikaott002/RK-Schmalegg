import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// === SECURITY UPDATE START: GLOBAL SESSION WATCHER ===
//initializeSessionSecurity()
// === SECURITY UPDATE END: GLOBAL SESSION WATCHER ===

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
