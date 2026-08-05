// Sorgente degli orari di apertura.
// I dati arrivano da Supabase (tabella "orari"): scaricati in fase di build da
// scripts/build-data.mjs e salvati in ./generated/hours.json. Se mancano o non
// sono validi, si usa la copia di sicurezza in ./fallback/hours.js.

import generatedHours from './generated/hours.json';
import { openingHours as fallbackHours } from './fallback/hours';

function isValid(data) {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((d) => d && typeof d.day === 'string' && d.day)
  );
}

const g = generatedHours && typeof generatedHours === 'object' ? generatedHours : {};

export const openingHours = isValid(g.openingHours) ? g.openingHours : fallbackHours;
