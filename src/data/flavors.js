// Sorgente dei gusti del menù.
// I dati arrivano da Supabase (tabella "allergeni_prodotti"): vengono scaricati in
// fase di build dallo script scripts/build-data.mjs e salvati in ./generated/menu.json.
// Se i dati generati mancano o non sono validi, si usa la copia di sicurezza
// in ./fallback/flavors.js — così il sito non resta mai senza menù.
// Per i componenti la forma dei dati è identica a prima.

import generatedMenu from './generated/menu.json';
import { flavorCategories as fallbackCategories } from './fallback/flavors';

function isValidMenu(data) {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every(
      (c) => c && typeof c.id === 'string' && Array.isArray(c.flavors) && c.flavors.length > 0
    )
  );
}

// I dati generati sono più vecchi delle novità arrivate dalla scheda dei titolari
// (descrizione del gusto, categoria "Altre Leccornie"): qui garantiamo che ogni
// categoria e ogni gusto abbiano sempre i campi che i componenti si aspettano —
// `desc` resta vuoto finché non arriva da Supabase, senza rompere il menù.
const normalize = (categories) =>
  categories.map((c) => ({
    description: '',
    ...c,
    flavors: (c.flavors || []).map((f) => ({ desc: '', tag: null, diet: [], ...f })),
  }));

export const flavorCategories = normalize(
  isValidMenu(generatedMenu) ? generatedMenu : fallbackCategories
);
