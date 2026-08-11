// Pezzi condivisi dalle homepage candidate /v3 /v4 /v5.
// La /v2 resta com'è (già passata in review); qui evitiamo solo di
// triplicare dati live, contatore e costanti di contatto.
import { useState, useEffect, useRef } from 'react';
import { useInView, animate, useReducedMotion } from 'framer-motion';
import { flavorCategories as fallbackCategories } from '../data/flavors';
import { openingHours as fallbackHours } from '../data/hours';
import { fetchMenu, fetchHours } from '../data/live';

export const WA_URL = 'https://api.whatsapp.com/send?phone=393203306009';
export const MAPS_URL = 'https://goo.gl/maps/s96Pk7NbEPJhneC66';
export const IG_URL = 'https://www.instagram.com/gelateriapuntogicarpi/';
export const FB_URL = 'https://www.facebook.com/gelateriapuntogicarpi';
export const MAP_EMBED = 'https://www.google.com/maps?q=Via+Remesina+Interna+46,+Carpi+MO&output=embed';

export const VERSIONS = [
  { href: '/', label: 'Classica' },
  { href: '/v2', label: 'V2 · Etichetta' },
  { href: '/v3', label: 'V3 · Sagra' },
  { href: '/v4', label: 'V4 · Marmo' },
  { href: '/v5', label: 'V5 · Vassoio' },
  { href: '/v6', label: 'V6 · Vetrina' },
  { href: '/v7', label: 'V7 · Classica+' },
  { href: '/v8', label: 'V8 · Il Negozio' },
];

/** Menù live con fallback statico (stessa logica della v1/v2). */
export function useMenu() {
  const [categories, setCategories] = useState(fallbackCategories);
  useEffect(() => {
    let alive = true;
    fetchMenu().then((data) => {
      if (alive && data?.length) setCategories(data);
    });
    return () => { alive = false; };
  }, []);
  return categories;
}

/** Orari live con fallback statico. */
export function useHours() {
  const [hours, setHours] = useState(fallbackHours);
  useEffect(() => {
    let alive = true;
    fetchHours().then((data) => {
      if (alive && data?.length) setHours(data);
    });
    return () => { alive = false; };
  }, []);
  return hours;
}

/** Prime tre lettere del giorno di oggi in italiano ("dom", "lun", ...). */
export const todayKey = () =>
  new Date().toLocaleDateString('it-IT', { weekday: 'long' }).toLowerCase().slice(0, 3);

/** Contatore che parte quando entra a schermo; rispetta riduci-animazioni. */
export function Counter({ to, duration = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return undefined;
    if (reduce) { setN(to); return undefined; }
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setN(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to, duration, reduce]);
  return <span ref={ref}>{String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</span>;
}

export const WaGlyph = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.842 2.708.842.36 0 .724-.075 1.062-.244.5-.247 1.232-.823 1.434-1.43.057-.148.057-.295.072-.443-.067-.115-.247-.18-.434-.247z" />
    <path d="M16.04 0h-.083C7.176 0 .002 7.176.002 16.005c0 3.5 1.13 6.74 3.045 9.376L1.038 31.405l6.243-1.99a15.93 15.93 0 0 0 8.76 2.61c8.78 0 15.957-7.176 15.957-16.005C32 7.18 24.824 0 16.04 0zm0 28.526c-2.81 0-5.42-.85-7.6-2.31l-5.297 1.69 1.722-5.13a13.14 13.14 0 0 1-2.55-7.793c0-7.27 5.94-13.18 13.215-13.18 7.27 0 13.225 5.91 13.225 13.18 0 7.275-5.955 13.18-13.225 13.18z" />
  </svg>
);

/** Imposta titolo, theme-color e sfondo body per la durata della pagina. */
export function usePageChrome(title, themeColor, bodyBg) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    const meta = document.querySelector('meta[name="theme-color"]');
    const prevTheme = meta?.getAttribute('content');
    if (themeColor) meta?.setAttribute('content', themeColor);
    const prevBg = document.body.style.background;
    if (bodyBg) document.body.style.background = bodyBg;
    return () => {
      document.title = prevTitle;
      if (meta && prevTheme) meta.setAttribute('content', prevTheme);
      document.body.style.background = prevBg;
    };
  }, [title, themeColor, bodyBg]);
}
