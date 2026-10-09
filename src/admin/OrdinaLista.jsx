import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { gruppiDi } from '../lib/riordina';
import { creaMotoreOrdine } from '../lib/motoreOrdine';

/**
 * L'ORDINE delle voci di una lista del configuratore, cambiato con le frecce
 * ▲ ▼ (richiesta dei titolari, ottobre 2026). La apre «↕ Cambia ordine» di
 * ogni scheda (TableEditor); la scheda Gusti la usa anche per l'ordine dei
 * gusti nel configuratore torte, che è separato da quello della carta.
 *
 * Perché una lista a parte e non le frecce dentro le righe di modifica: la
 * riga di un gusto è alta un quarto di schermo, e spostarla di dieci posti a
 * colpi di freccia (da telefono!) sarebbe un calvario. Qui una voce è una riga.
 *
 * Ogni tocco sposta subito in pagina; il salvataggio parte da solo mezzo
 * secondo dopo l'ultimo tocco, controlla che nessun altro dispositivo abbia
 * cambiato la lista e scrive solo le righe che cambiano (src/lib/motoreOrdine.js).
 * Con «Fine», cambiando scheda o chiudendo il riquadro, quello che è in
 * sospeso si salva subito. Le regole (numeri, gemelle vegetali, vicini) sono
 * in src/lib/riordina.js.
 *
 * props:
 *  - table, chiave ('ordine', oppure 'ordine_torte'), titolo (per lo storico)
 *  - universo(riga): le righe che fanno parte della lista (default: tutte)
 *  - visibile(riga): quelle che si vedono qui (es. solo le taglie normali)
 *  - ambito(riga) + ambiti [{ value, label }]: le voci si spostano solo
 *    dentro il loro ambito (es. la categoria della carta) e si mostrano a
 *    gruppi, nell'ordine di `ambiti`
 *  - etichetta(riga), versione (ricarica quando cambia), onCambio, onFine
 *  - avvisoMigrazione: cosa dire se la colonna `chiave` non c'è ancora
 */

const tutte = () => true;
const NESSUN_AMBITO = []; // sempre lo stesso array: le voci non si ricalcolano a ogni render
const nomeVoce = (r) => r.nome || r.gusto || r.etichetta || r.titolo || r.codice || r.giorno || 'voce';

export default function OrdinaLista({
  table,
  chiave = 'ordine',
  titolo = '',
  universo = tutte,
  visibile = tutte,
  ambito,
  ambiti = NESSUN_AMBITO,
  etichetta = nomeVoce,
  versione = 0,
  onCambio,
  onFine,
  avvisoMigrazione = '',
}) {
  const [righe, setRighe] = useState([]);
  const [caricato, setCaricato] = useState(false);
  const [senzaColonna, setSenzaColonna] = useState(false);
  const [errore, setErrore] = useState('');
  const [avviso, setAvviso] = useState('');
  const [stato, setStato] = useState(''); // '' | 'salvo' | 'salvato'
  const [annuncio, setAnnuncio] = useState(''); // per il lettore di schermo

  // Le funzioni passate da fuori cambiano a ogni render: il motore le legge
  // da qui, così anche un salvataggio partito prima usa quelle di adesso.
  const props = useRef(null);
  props.current = { universo, visibile, ambito, etichetta, onCambio, onFine, titolo };
  const dopoMossa = useRef(null); // { id, delta }: dove rimettere il fuoco
  const bottoni = useRef(new Map());

  // Un motore per tutta la vita della lista (tabella e colonna non cambiano).
  const motore = useRef(null);
  if (!motore.current) {
    motore.current = creaMotoreOrdine({
      chiave,
      universo: (r) => props.current.universo(r),
      leggi: () => supabase.from(table).select('*'),
      scrivi: (id, numero) => supabase.from(table).update({ [chiave]: numero }).eq('id', id).select('id'),
      avvisa: (p) => {
        if ('righe' in p) setRighe(p.righe);
        if ('caricato' in p) setCaricato(p.caricato);
        if ('senzaColonna' in p) setSenzaColonna(p.senzaColonna);
        if ('stato' in p) setStato(p.stato);
        if ('errore' in p) setErrore(p.errore);
        if ('avviso' in p) setAvviso(p.avviso);
      },
      salvato: (nomi) => {
        logAction('Ordine cambiato', `${props.current.titolo}: ${nomi.join(', ') || 'lista'}`);
        props.current.onCambio?.();
      },
    });
  }

  // Caricamento; di nuovo quando la lista principale salva (`versione`):
  // prima però si salva quello che è in sospeso, così non si perde.
  useEffect(() => {
    const m = motore.current;
    (async () => {
      await m.salvaSubito();
      await m.carica();
    })();
  }, [versione]);

  // Si cambia scheda, o si chiude il riquadro, con un tocco in sospeso: si
  // salva lo stesso (se non c'è niente da salvare non parte nessuna richiesta).
  useEffect(() => {
    const m = motore.current;
    return () => { m.salvaSubito(); };
  }, []);

  async function fine() {
    const ok = await motore.current.salvaSubito();
    // Se il salvataggio non è andato si resta qui: il messaggio va letto.
    if (ok) props.current.onFine?.();
  }

  function sposta(gruppo, delta) {
    const { visibile: vis, ambito: amb, etichetta: eti } = props.current;
    const mossa = motore.current.sposta(gruppo.id, delta, {
      visibile: vis,
      stessoAmbito: amb ? (a, b) => amb(a) === amb(b) : undefined,
      nome: eti(gruppo.riga),
    });
    if (mossa) dopoMossa.current = { id: gruppo.id, delta };
  }

  // Le voci da mostrare: una per riga, o per coppia originale + gemella
  // vegetale; a gruppi se c'è un ambito (es. le categorie della carta).
  const sezioni = useMemo(() => {
    const { visibile: vis, ambito: amb } = props.current;
    const voci = gruppiDi(righe, chiave).filter((gr) => gr.righe.some(vis));
    if (!amb) return [{ chiave: '', titolo: '', voci }];
    const perAmbito = new Map();
    for (const gr of voci) {
      const k = String(amb(gr.riga) ?? '');
      if (!perAmbito.has(k)) perAmbito.set(k, []);
      perAmbito.get(k).push(gr);
    }
    const noti = ambiti.map((a) => a.value);
    const chiavi = [...noti.filter((k) => perAmbito.has(k)), ...[...perAmbito.keys()].filter((k) => !noti.includes(k))];
    return chiavi.map((k) => ({
      chiave: k,
      titolo: ambiti.find((a) => a.value === k)?.label || k || 'Senza categoria',
      voci: perAmbito.get(k),
    }));
  }, [righe, chiave, ambiti]);

  // Dopo una mossa: il fuoco torna sulla freccia appena usata (o sull'altra,
  // se la voce è arrivata in cima o in fondo), la riga resta in vista e il
  // lettore di schermo dice la posizione nuova.
  useEffect(() => {
    const m = dopoMossa.current;
    if (!m) return;
    dopoMossa.current = null;
    for (const s of sezioni) {
      const i = s.voci.findIndex((gr) => gr.id === m.id);
      if (i >= 0) {
        setAnnuncio(`${props.current.etichetta(s.voci[i].riga)}: posizione ${i + 1} di ${s.voci.length}`);
        break;
      }
    }
    let b = bottoni.current.get(`${m.id}:${m.delta}`);
    if (!b || b.disabled) b = bottoni.current.get(`${m.id}:${-m.delta}`);
    if (b) {
      b.focus({ preventScroll: true });
      b.closest('li')?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [sezioni]);

  const registra = (id, delta) => (el) => {
    const k = `${id}:${delta}`;
    if (el) bottoni.current.set(k, el);
    else bottoni.current.delete(k);
  };

  const vuota = sezioni.every((s) => !s.voci.length);

  return (
    <div className="ol">
      <div className="ol-testa">
        <p className="ol-aiuto">
          Tocca ▲ ▼ per spostare una voce: il nuovo ordine si salva da solo.
          {stato === 'salvo' && <span className="ol-stato"> Salvo…</span>}
          {stato === 'salvato' && <span className="ol-stato ok"> ✓ Salvato</span>}
        </p>
        {onFine && (
          <button type="button" className="adm-btn adm-btn-save" onClick={fine}>
            Fine
          </button>
        )}
      </div>

      {errore && <div className="adm-error">⚠️ {errore}</div>}
      {avviso && <div className="mis-avviso" role="status">{avviso}</div>}
      {!caricato && <div className="adm-muted">Caricamento…</div>}
      {caricato && senzaColonna && (
        <div className="mis-avviso">
          {avvisoMigrazione || 'Questo ordine si attiva eseguendo una volta su Supabase la migrazione migrations/2026-10-09-dashboard-ottobre.sql.'}
        </div>
      )}
      {caricato && !senzaColonna && vuota && !errore && <div className="adm-muted">Nessuna voce da ordinare.</div>}

      {caricato && !senzaColonna && sezioni.map((s) => s.voci.length > 0 && (
        <section key={s.chiave || 'tutte'} className="ol-sezione" aria-label={s.titolo || titolo || undefined}>
          {s.titolo && <h4 className="ol-sez-tit">{s.titolo}</h4>}
          <ol className="ol-lista">
            {s.voci.map((gr, i) => {
              const r = gr.riga;
              const nome = etichetta(r);
              const spenta = r.attivo === false;
              return (
                <li key={gr.id} className={`ol-voce ${spenta ? 'off' : ''}`}>
                  <span className="ol-pos" aria-hidden="true">{i + 1}</span>
                  {r.emoji ? (
                    <span className="ol-segno" aria-hidden="true">{r.emoji}</span>
                  ) : r.colore ? (
                    <span className="ol-pallino" aria-hidden="true" style={{ background: r.colore }} />
                  ) : null}
                  <span className="ol-nome">
                    {nome}
                    {/* La gemella vegetale si sposta con lei: lo si dice. */}
                    {gr.righe.length > 1 && <small> e la vegetale</small>}
                    {spenta && <small> · nascosto</small>}
                  </span>
                  <span className="ol-frecce">
                    <button
                      ref={registra(gr.id, -1)}
                      type="button"
                      className="adm-btn ol-freccia"
                      aria-label={`Sposta ${nome} più su`}
                      disabled={i === 0}
                      onClick={() => sposta(gr, -1)}
                    >
                      ▲
                    </button>
                    <button
                      ref={registra(gr.id, 1)}
                      type="button"
                      className="adm-btn ol-freccia"
                      aria-label={`Sposta ${nome} più giù`}
                      disabled={i === s.voci.length - 1}
                      onClick={() => sposta(gr, 1)}
                    >
                      ▼
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <p className="adm-sr" aria-live="polite">{annuncio}</p>
    </div>
  );
}
