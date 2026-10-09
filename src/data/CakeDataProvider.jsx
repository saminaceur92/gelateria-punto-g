import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as fb from './cakeOptions';
import { fetchCakeOptions } from './live';

// Dati del configuratore torte: partono dai dati di sicurezza (statici) e
// vengono aggiornati live da Supabase. Le ricette "Sorprendimi" restano statiche.

const fallback = {
  cakeShapes: fb.cakeShapes,
  cakeTypes: fb.cakeTypes,
  cakeSizes: fb.cakeSizes,
  cakeFlavors: fb.cakeFlavors,
  cakeBases: fb.cakeBases,
  cakeCrumbles: fb.cakeCrumbles,
  cakeFillings: fb.cakeFillings,
  cakeCoverings: fb.cakeCoverings,
  cakeDecorations: fb.cakeDecorations,
  cakeScritte: fb.cakeScritte,
  cakeExtras: fb.cakeExtras,
  cakeOccasions: fb.cakeOccasions,
  cakeAllergens: fb.cakeAllergens,
};

const CakeDataCtx = createContext({ ...fallback, cakeRecipes: fb.cakeRecipes, torteConsigliate: fb.torteConsigliate });

export function CakeDataProvider({ children }) {
  const [data, setData] = useState(fallback);
  const vivo = useRef(true);

  // Rilegge il listino da Supabase. Gira all'avvio e a ogni apertura del
  // configuratore (vedi CakeConfigurator): la dashboard al banco resta aperta
  // tutto il giorno, e un listino letto una volta sola continuerebbe a vendere
  // ai prezzi del mattino, per esempio le torte alte con le taglie normali
  // dopo che i titolari hanno acceso le loro. Se la lettura fallisce restano i
  // dati di prima. Restituisce i dati nuovi, oppure null.
  const ricarica = useCallback(async () => {
    const d = await fetchCakeOptions();
    if (vivo.current && d) setData(d);
    return d || null;
  }, []);

  useEffect(() => {
    vivo.current = true;
    ricarica();
    return () => {
      vivo.current = false;
    };
  }, [ricarica]);

  // cakeRecipes e torteConsigliate restano sempre dai dati statici
  const value = { ...data, ricarica, cakeRecipes: fb.cakeRecipes, torteConsigliate: fb.torteConsigliate };
  return <CakeDataCtx.Provider value={value}>{children}</CakeDataCtx.Provider>;
}

export const useCakeData = () => useContext(CakeDataCtx);
