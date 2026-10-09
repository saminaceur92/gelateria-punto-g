import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Cosa vede ADESSO chi ordina una torta alta (tab Dimensioni, gruppo alte).
 *
 * Le alte passano dalle taglie normali alle loro appena se ne accende anche
 * una sola (taglieDelTipo in src/lib/misureTorta.js): accenderle "una alla
 * volta" lascia per un po' le alte con le sole taglie già accese. Detto a
 * parole nel sottotitolo non basta, quindi qui si mostra lo stato vero.
 * Si rilegge a ogni modifica delle taglie (prop `versione`).
 */
export default function StatoTaglieAlte({ versione = 0 }) {
  // null = non ancora letto, oppure colonna `alta` non ancora creata: niente da dire.
  const [accese, setAccese] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase
      .from('dimensioni')
      .select('etichetta')
      .eq('alta', true)
      .eq('attivo', true)
      .order('ordine', { ascending: true })
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (vivo) setAccese(error ? null : (data || []).map((r) => r.etichetta || 'senza nome'));
      });
    return () => {
      vivo = false;
    };
  }, [versione]);

  if (accese === null) return null;
  return (
    <p className={`dim-stato ${accese.length ? 'accese' : ''}`} role="status">
      {accese.length ? (
        <>Adesso sul sito le torte alte si ordinano <strong>solo</strong> in queste taglie: {accese.join(', ')}.</>
      ) : (
        <>Adesso sul sito le torte alte usano le <strong>taglie normali</strong>: nessuna taglia alta è accesa.</>
      )}
    </p>
  );
}
