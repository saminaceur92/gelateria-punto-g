// Lettura del listino LATO SERVER, tutto insieme, a ogni pagamento.
//
// - Si leggono TUTTE le righe, anche quelle spente: servono per dire al
//   cliente «X non è più disponibile» invece di un generico "non trovato".
// - select('*') come fa il sito (live.js): una colonna nuova o non ancora
//   creata non fa mai fallire la lettura. Per esempio `forme.per_normali` e
//   `forme.per_alte` (punto 17): prima della migrazione semplicemente mancano,
//   e ogni forma accesa vale per tutti.
// - Nessuna cache fra una richiesta e l'altra: il caso "taglia non valida"
//   nasce proprio da listini vecchi.
// - Un errore di lettura NON vale zero euro: si ferma il pagamento
//   (ListinoNonDisponibile → 503 in create-checkout). Prima, se Supabase non
//   rispondeva, quel pezzo di torta si addebitava a 0 €.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Listino, Riga } from './valida.ts';

export class ListinoNonDisponibile extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ListinoNonDisponibile';
  }
}

// Le 8 tabelle senza le quali il configuratore del sito non parte (live.js
// rinuncia al listino vivo se una di queste dà errore): qui qualsiasi errore
// ferma il pagamento.
const OBBLIGATORIE = [
  'tipi_torta', 'dimensioni', 'forme', 'basi', 'farciture', 'coperture', 'decorazioni', 'occasioni',
] as const;
// Tabelle che il sito tratta come facoltative (se mancano usa la sua copia di
// sicurezza o ne fa a meno): se NON ESISTONO valgono vuote, ma un errore di
// rete ferma il pagamento lo stesso, perché non sappiamo cosa c'è dentro.
const FACOLTATIVE = [
  'crumble', 'extra', 'scritte', 'allergeni', 'allergeni_prodotti', 'gusti_torte',
] as const;

// "Tabella inesistente": 42P01 da Postgres, PGRST205 dalle versioni nuove di
// PostgREST ("Could not find the table … in the schema cache").
const tabellaMancante = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205');

export async function caricaListino(supabase: SupabaseClient): Promise<Listino> {
  const nomi = [...OBBLIGATORIE, ...FACOLTATIVE];
  let risposte;
  try {
    risposte = await Promise.all(nomi.map((t) => supabase.from(t).select('*')));
  } catch (e) {
    throw new ListinoNonDisponibile(`lettura fallita: ${(e as Error)?.message ?? e}`);
  }
  const L = {} as Record<string, Riga[]>;
  nomi.forEach((t, i) => {
    const { data, error } = risposte[i] as { data: unknown; error: { code?: string; message?: string } | null };
    if (error && (FACOLTATIVE as readonly string[]).includes(t) && tabellaMancante(error)) {
      L[t] = [];
      return;
    }
    if (error || !Array.isArray(data)) {
      throw new ListinoNonDisponibile(`${t}: ${error?.message ?? 'nessun dato'}`);
    }
    L[t] = data as Riga[];
  });
  return L as unknown as Listino;
}
