// Il "motore" della lista delle frecce ▲ ▼ (src/admin/OrdinaLista.jsx): tiene
// le righe come sono in pagina, decide cosa salvare e quando.
// Niente React né Supabase: lettura, scrittura e orologio arrivano da fuori,
// così si prova con un database finto:  node --test src/lib/motoreOrdine.test.mjs
//
// Come salva:
//  - ogni tocco sposta SUBITO in pagina; il salvataggio parte `ritardo` ms
//    dopo l'ultimo tocco (mezzo secondo), così dieci tocchi di fila diventano
//    un salvataggio solo;
//  - prima di scrivere rilegge la lista: se un altro dispositivo l'ha cambiata
//    nel frattempo, ricarica e lo dice, invece di scrivere numeri calcolati su
//    una lista che non c'è più;
//  - scrive una riga alla volta (di solito 2-4) e controlla che il database
//    l'abbia davvero toccata: un blocco dei permessi non dà errore, solo zero
//    righe;
//  - un salvataggio alla volta: i tocchi arrivati nel frattempo fanno un altro
//    giro appena finito quello in corso.

import { ordinaComeIlSito, riordina, applica, numeriDi, daScrivere, listaCambiata } from './riordina.js';

const OROLOGIO = {
  imposta: (fn, ms) => setTimeout(fn, ms),
  annulla: (t) => clearTimeout(t),
};

/**
 * opzioni:
 *  - chiave: colonna della posizione ('ordine' o 'ordine_torte')
 *  - universo(riga): le righe che fanno parte della lista
 *  - leggi(): Promise<{ data, error }> con TUTTE le righe della tabella
 *  - scrivi(id, numero): Promise<{ data, error }>, data = righe toccate
 *  - avvisa(cosa): novità per la pagina, un oggetto con alcune fra
 *    { righe, caricato, senzaColonna, stato, errore, avviso }
 *  - salvato(nomi): dopo un salvataggio riuscito (storico, chi mostra i dati)
 *  - ritardo (ms), orologio { imposta, annulla }: per le prove
 */
export function creaMotoreOrdine({
  chiave = 'ordine',
  universo = () => true,
  leggi,
  scrivi,
  avvisa = () => {},
  salvato = () => {},
  ritardo = 500,
  orologio = OROLOGIO,
}) {
  let righe = []; // con i numeri in pagina
  let base = new Map(); // id → numero come ce l'ha il database
  let attesa = null; // salvataggio programmato
  let inCorso = null; // salvataggio in corso (promessa)
  let ancora = false; // tocchi arrivati durante il salvataggio
  const spostati = new Set(); // nomi per lo storico

  async function carica() {
    const { data, error } = await leggi();
    if (error) {
      avvisa({ errore: error.message, caricato: true });
      return false;
    }
    const tutte = data || [];
    righe = ordinaComeIlSito(tutte.filter((r) => universo(r)), chiave);
    base = numeriDi(righe, chiave);
    // Colonna non ancora creata (es. ordine_torte prima della migrazione):
    // select('*') semplicemente non la restituisce.
    avvisa({ righe, caricato: true, senzaColonna: tutte.length > 0 && !(chiave in tutte[0]) });
    return true;
  }

  // Un giro di salvataggio: true se è andato tutto bene.
  async function giro() {
    const scrivere = daScrivere(righe, base, chiave);
    if (!scrivere.length) return true;
    avvisa({ stato: 'salvo', errore: '' });
    const { data: fresche, error } = await leggi();
    if (error) {
      avvisa({ stato: '', errore: `Ordine non salvato: ${error.message}` });
      return false;
    }
    if (listaCambiata((fresche || []).filter((r) => universo(r)), base, chiave)) {
      await carica();
      avvisa({
        stato: '',
        avviso: "Nel frattempo questa lista è stata cambiata da un altro dispositivo: l'ho ricaricata. Se serve, ripeti lo spostamento.",
      });
      return false;
    }
    for (const voce of scrivere) {
      const { data, error: e } = await scrivi(voce.id, voce.numero);
      // Al primo intoppo ci si ferma e si ricarica: l'ordine resta comunque
      // stabile (a pari numero decide l'id) e la mossa dopo lo sistema.
      if (e || !data?.length) {
        await carica();
        avvisa({
          stato: '',
          errore: e
            ? `Ordine non salvato: ${e.message}`
            : 'Ordine non salvato: il database non ha accettato la modifica. Esci e rientra col tuo codice, poi riprova.',
        });
        return false;
      }
      base.set(String(voce.id), voce.numero);
    }
    const nomi = [...spostati];
    spostati.clear();
    avvisa({ stato: 'salvato' });
    salvato(nomi);
    return true;
  }

  function salva() {
    if (inCorso) {
      ancora = true;
      return inCorso;
    }
    inCorso = (async () => {
      let ok = true;
      try {
        do {
          ancora = false;
          ok = await giro();
        } while (ok && ancora);
      } catch (e) {
        ok = false;
        avvisa({ stato: '', errore: `Ordine non salvato: ${e?.message || 'errore imprevisto'}` });
      } finally {
        inCorso = null;
      }
      return ok;
    })();
    return inCorso;
  }

  /** Salva adesso quello che è in sospeso. Promessa: true se è andato bene. */
  function salvaSubito() {
    if (attesa !== null) {
      orologio.annulla(attesa);
      attesa = null;
    }
    return salva();
  }

  /**
   * Sposta una voce di un posto (delta -1 su, +1 giù). `visibile`,
   * `stessoAmbito`: come in riordina; `nome`: per lo storico.
   * Restituisce false se la voce non si può spostare.
   */
  function sposta(id, delta, { visibile, stessoAmbito, nome } = {}) {
    const res = riordina(righe, id, delta, { chiave, visibile, stessoAmbito });
    if (!res) return false;
    righe = applica(righe, res.cambi, chiave);
    if (nome) spostati.add(nome);
    avvisa({ righe, stato: '', avviso: '' });
    if (attesa !== null) orologio.annulla(attesa);
    attesa = orologio.imposta(() => {
      attesa = null;
      salva();
    }, ritardo);
    return true;
  }

  return {
    carica,
    sposta,
    salvaSubito,
    get righe() { return righe; },
  };
}
