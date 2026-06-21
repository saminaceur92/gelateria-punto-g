import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/configurator.css';
import './styles/configurator-mobile.css';

// La dashboard /admin è un'app a parte, caricata solo quando serve:
// il sito pubblico resta leggero e invariato.
const Admin = lazy(() => import('./admin/Admin'));
const isAdmin = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <Admin />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
