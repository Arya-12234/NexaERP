import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Login     from './components/Login';
import Register  from './components/Register';
import Dashboard from './components/Dashboard';
import Home      from './components/Home';

function App() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Give Firebase max 5 seconds to respond.
    // If it doesn't fire, stop loading and treat as logged out.
    const timeout = setTimeout(() => {
      console.warn('[NexaERP] Firebase auth timeout — proceeding as logged out.');
      setLoading(false);
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        clearTimeout(timeout);
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        // Firebase auth error (e.g. bad config, network)
        clearTimeout(timeout);
        console.error('[NexaERP] Firebase auth error:', error.message);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#faf7f2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        gap: 16,
      }}>
        {/* Spinner */}
        <div style={{
          width: 36, height: 36,
          border: '3px solid #e6f7f4',
          borderTop: '3px solid #1a6b5a',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 15, color: '#1a6b5a', fontWeight: 600 }}>
          Loading NexaERP...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Router>
      <Routes>

        {/* ── Public homepage — no login needed ── */}
        <Route path="/home" element={<Home />} />

        {/* ── Protected ERP dashboard ── */}
        <Route
          path="/"
          element={user ? <Dashboard userEmail={user.email} /> : <Navigate to="/home" />}
        />

        {/* ── Auth pages ── */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" /> : <Register />}
        />

        {/* ── Fallback ── */}
        <Route path="*" element={<Navigate to="/home" />} />

      </Routes>
    </Router>
  );
}

export default App;