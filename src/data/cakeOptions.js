// Sorgente delle opzioni del configuratore torte.
// I dati arrivano da Supabase: scaricati in fase di build da scripts/build-data.mjs
// e salvati in ./generated/cake.json. Se mancano o non sono validi, si usa la
// copia di sicurezza in ./fallback/cakeOptions.js.
// Per i componenti la forma dei dati è identica a prima (include i dati 3D:
// forme, farciture, coperture, ricette).

import generatedCake from './generated/cake.json';
import * as fallback from './fallback/cakeOptions';

const g = generatedCake && typeof generatedCake === 'object' ? generatedCake : {};

// Usa la lista generata solo se è un array non vuoto, altrimenti il fallback.
// Se manca anche quello (voce nuova non ancora nella copia di sicurezza) si
// restituisce una lista vuota: i componenti ricevono sempre un array.
const pick = (list, fb) => {
  if (Array.isArray(list) && list.length > 0) return list;
  return Array.isArray(fb) ? fb : [];
};

export const cakeShapes = pick(g.cakeShapes, fallback.cakeShapes);
export const cakeTypes = pick(g.cakeTypes, fallback.cakeTypes);
export const cakeSizes = pick(g.cakeSizes, fallback.cakeSizes);
export const cakeFlavors = pick(g.cakeFlavors, fallback.cakeFlavors);
export const cakeBases = pick(g.cakeBases, fallback.cakeBases);
export const cakeCrumbles = pick(g.cakeCrumbles, fallback.cakeCrumbles);
export const cakeFillings = pick(g.cakeFillings, fallback.cakeFillings);
export const cakeCoverings = pick(g.cakeCoverings, fallback.cakeCoverings);
export const cakeDecorations = pick(g.cakeDecorations, fallback.cakeDecorations);
// Stili della scritta sulla torta e prodotti extra (salame, cabaret di pasticcini):
// tabelle nuove su Supabase, qui restano i dati di sicurezza.
export const cakeScritte = pick(g.cakeScritte, fallback.cakeScritte);
export const cakeExtras = pick(g.cakeExtras, fallback.cakeExtras);
export const cakeOccasions = pick(g.cakeOccasions, fallback.cakeOccasions);
export const cakeAllergens = pick(g.cakeAllergens, fallback.cakeAllergens);
export const cakeRecipes = pick(g.cakeRecipes, fallback.cakeRecipes);
// "Le nostre consigliate": statiche come le ricette, non passano dalla build.
export const torteConsigliate = pick(g.torteConsigliate, fallback.torteConsigliate);

// Base che apre lo step di scelta del tipo di crumble ("Crumble croccante").
// È l'id della riga in `basi` su Supabase: non va cambiato.
export const CRUMBLE_BASE_ID = 'crock';

// Le torte ALTE: accettano 4 gusti invece di 3 e nell'anteprima 3D sono
// visibilmente più alte. Sono gli id delle righe in `tipi_torta` su Supabase.
export const TALL_TYPE_IDS = ['piani', 'alta-gelato'];
export const isTallType = (id) => TALL_TYPE_IDS.includes(id);
