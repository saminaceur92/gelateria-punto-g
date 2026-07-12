import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/configurator.css';
import './styles/configurator-mobile.css';

// La dashboard /admin e la pagina /allergeni sono caricate solo quando servono:
// il sito pubblico resta leggero e invariato.
const Admin = lazy(() => import('./admin/Admin'));
const Allergeni = lazy(() => import('./pages/Allergeni'));
const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isAllergeni = path.startsWith('/allergeni');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <Admin />
      </Suspense>
    ) : isAllergeni ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <Allergeni />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
