// Sorgente dei gusti del menù.
// I dati arrivano da Airtable: vengono scaricati in fase di build dallo script
// scripts/build-data.mjs e salvati in ./generated/menu.json.
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

export const flavorCategories = isValidMenu(generatedMenu) ? generatedMenu : fallbackCategories;
