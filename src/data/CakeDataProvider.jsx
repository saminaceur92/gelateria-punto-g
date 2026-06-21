import { createContext, useContext, useEffect, useState } from 'react';
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
  cakeFillings: fb.cakeFillings,
  cakeCoverings: fb.cakeCoverings,
  cakeDecorations: fb.cakeDecorations,
  cakeOccasions: fb.cakeOccasions,
};

const CakeDataCtx = createContext({ ...fallback, cakeRecipes: fb.cakeRecipes });

export function CakeDataProvider({ children }) {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    let alive = true;
    fetchCakeOptions().then((d) => {
      if (alive && d) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  // cakeRecipes resta sempre dai dati statici
  const value = { ...data, cakeRecipes: fb.cakeRecipes };
  return <CakeDataCtx.Provider value={value}>{children}</CakeDataCtx.Provider>;
}

export const useCakeData = () => useContext(CakeDataCtx);
