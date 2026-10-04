import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import UserPage from './pages/UserPage';
// === PASSWORD RESET START: RESET PAGE IMPORT ===
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
// === PASSWORD RESET END: RESET PAGE IMPORT ===
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          {/* === SECURITY UPDATE START: VERIFIED SELF-REGISTRATION ENTRY === */}
          <Route path="/login" element={<LoginPage />} />
          {/* === PASSWORD RESET START: RESET ROUTE === */}
          <Route
            path="/reset-password"
            element={<ResetPasswordPage />}
          />
{/* === PASSWORD RESET END: RESET ROUTE === */}
          {/* === SECURITY UPDATE END: VERIFIED SELF-REGISTRATION ENTRY === */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/events" element={<AdminPage />} />
          <Route path="/admin/events/:eventId" element={<AdminPage />} />
          <Route path="/admin/events/:eventId/timeslots" element={<AdminPage />} />
          <Route path="/admin/events/:eventId/timeslots/:timeslotId" element={<AdminPage />} />
          <Route path="/admin/events/:eventId/timeslots/:timeslotId/participants" element={<AdminPage />} />
          <Route path="/admin/events/create" element={<AdminPage />} />
          <Route path="/admin/events/:eventId/edit" element={<AdminPage />} />
          <Route path="/admin/persons" element={<AdminPage />} />
          <Route path="/user/:userId" element={<UserPage />} />
          <Route path="/user/:userId/events" element={<UserPage />} />
          <Route path="/user/:userId/events/:eventId" element={<UserPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
