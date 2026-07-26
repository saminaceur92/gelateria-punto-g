// Sorgente delle opzioni del configuratore torte.
// I dati arrivano da Airtable: scaricati in fase di build da scripts/build-data.mjs
// e salvati in ./generated/cake.json. Se mancano o non sono validi, si usa la
// copia di sicurezza in ./fallback/cakeOptions.js.
// Per i componenti la forma dei dati è identica a prima (include i dati 3D:
// forme, farciture, coperture, ricette).

import generatedCake from './generated/cake.json';
import * as fallback from './fallback/cakeOptions';

const g = generatedCake && typeof generatedCake === 'object' ? generatedCake : {};

// Usa la lista generata solo se è un array non vuoto, altrimenti il fallback.
const pick = (list, fb) => (Array.isArray(list) && list.length > 0 ? list : fb);

export const cakeShapes = pick(g.cakeShapes, fallback.cakeShapes);
export const cakeTypes = pick(g.cakeTypes, fallback.cakeTypes);
export const cakeSizes = pick(g.cakeSizes, fallback.cakeSizes);
export const cakeFlavors = pick(g.cakeFlavors, fallback.cakeFlavors);
export const cakeBases = pick(g.cakeBases, fallback.cakeBases);
export const cakeCrumbles = pick(g.cakeCrumbles, fallback.cakeCrumbles);
export const cakeFillings = pick(g.cakeFillings, fallback.cakeFillings);
export const cakeCoverings = pick(g.cakeCoverings, fallback.cakeCoverings);
export const cakeDecorations = pick(g.cakeDecorations, fallback.cakeDecorations);
export const cakeOccasions = pick(g.cakeOccasions, fallback.cakeOccasions);
export const cakeAllergens = pick(g.cakeAllergens, fallback.cakeAllergens);
export const cakeRecipes = pick(g.cakeRecipes, fallback.cakeRecipes);

// Base che apre lo step di scelta del tipo di crumble ("Crumble croccante").
// È l'id della riga in `basi` su Supabase: non va cambiato.
export const CRUMBLE_BASE_ID = 'crock';
