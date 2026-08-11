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
const HomeV2 = lazy(() => import('./pages/HomeV2'));
const HomeV3 = lazy(() => import('./pages/HomeV3'));
const HomeV4 = lazy(() => import('./pages/HomeV4'));
const HomeV5 = lazy(() => import('./pages/HomeV5'));
const HomeV6 = lazy(() => import('./pages/HomeV6'));
const HomeV7 = lazy(() => import('./pages/HomeV7'));
const HomeV8 = lazy(() => import('./pages/HomeV8'));
const path = window.location.pathname;
const isAdmin = path.startsWith('/admin');
const isAllergeni = path.startsWith('/allergeni');
// Le homepage candidate /v2../v8 restano rotte separate finché non se ne
// promuove una: la home ufficiale è sempre App su "/".
const versionMatch = path.match(/^\/v([2-8])(\/|$)/);
const VersionPage = versionMatch
  ? { 2: HomeV2, 3: HomeV3, 4: HomeV4, 5: HomeV5, 6: HomeV6, 7: HomeV7, 8: HomeV8 }[versionMatch[1]]
  : null;

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
    ) : VersionPage ? (
      <Suspense fallback={<div style={{ padding: 40, fontFamily: 'system-ui' }}>Caricamento…</div>}>
        <VersionPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
