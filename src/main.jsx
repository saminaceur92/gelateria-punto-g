import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { avviaAnalytics } from './lib/analytics';
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

// Statistiche del sito: si accende per tutti tranne che in dashboard, perché
// il titolare che gira fra le sue schede non è traffico e falserebbe i suoi
// stessi numeri. Sta qui, fuori da React, così parte una volta sola (StrictMode
// monta gli effetti due volte in sviluppo).
//
// Import statico e non dinamico: il configuratore importa già analytics in
// modo statico, quindi il modulo finisce comunque nel chunk principale e un
// import() qui non rimanderebbe niente — si limiterebbe a far stampare a Vite
// un warning a ogni build. Quello che NON entra mai nel sito pubblico è
// src/lib/statistiche.js, che è il file che legge i numeri: è per quello che
// scrittura e lettura sono due moduli separati.
if (!isAdmin) avviaAnalytics();

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
