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
// /galleria (non /gallery: quella è la cartella delle immagini in public/)
const Galleria = lazy(() => import('./pages/Galleria'));
const Consegna = lazy(() => import('./pages/Consegna'));
const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isAllergeni = path.startsWith('/allergeni');
const isGalleria = path.startsWith('/galleria');
const isConsegna = path.startsWith('/consegna');

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
    ) : isGalleria ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <Galleria />
      </Suspense>
    ) : isConsegna ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <Consegna />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
