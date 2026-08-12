import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { daConfigurare, riepilogo } from '../lib/statistiche';

/**
 * Scheda "Statistiche": quanta gente apre il sito e cosa ci clicca.
 *
 * Qui dentro non si legge nessuna tabella. Tutto arriva già sommato dalla
 * funzione `statistiche_riepilogo` del database (migrazione
 * migrations/2026-08-12-statistiche-sito.sql), che è l'unica cosa che il
 * browser può chiamare: i numeri del negozio non devono essere leggibili da
 * chiunque abbia la chiave pubblica del sito, e i conti li ha già fatti il
 * database. Al pannello resta solo da raggruppare e disegnare.
 *
 * Forma della risposta. È tutta facoltativa: se un pezzo manca la scheda mostra
 * zero e non si rompe, perché una statistica che esplode è peggio di una
 * statistica vuota.
 *
 *   giorni         1 | 7 | 30 | 90 — quello davvero usato dal database
 *   dal, al        estremi del periodo, date 'AAAA-MM-GG' (fuso di Roma)
 *   passo          'giorno' | 'settimana' — quanto vale una barra del grafico
 *   ultimo_evento  quando è arrivato l'ultimo dato in assoluto
 *   sintesi        { ora: {…}, prima: {…} }, dove {…} è
 *                  { visite, contatti, mappe, torte_pagate, da_telefono, eventi }.
 *                  "prima" è il periodo precedente di pari durata, per il confronto.
 *   andamento      [{ giorno, visite, contatti }] una voce per barra, buchi
 *                  compresi (li riempie il database: un giorno saltato nel
 *                  grafico racconterebbe una bugia)
 *   eventi         [{ chiave, etichetta, gruppo, ordine, conteggio }] TUTTI gli
 *                  eventi a catalogo, anche quelli mai successi: sono proprio
 *                  gli zeri a dire dove la gente si ferma
 *   provenienze    [{ voce, conteggio }] da dove sono arrivati (solo le visite)
 *   pagine         [{ voce, conteggio }] quali pagine hanno aperto
 *
 * Le etichette in italiano degli eventi stanno nel catalogo lato database, non
 * qui: se un domani cambia il nome di un evento si cambia in un posto solo.
 */

// Periodi proposti. Sono gli stessi che il database accetta: qualunque altro
// valore verrebbe ricondotto a 30, quindi non ha senso offrirlo.
const PERIODI = [
  { giorni: 1, label: 'Oggi' },
  { giorni: 7, label: '7 giorni' },
  { giorni: 30, label: '30 giorni' },
  { giorni: 90, label: '90 giorni' },
];

// Provenienza e pagina non sono eventi: sono colonne, e i loro valori arrivano
// dal database in forma corta. I nomi per il titolare stanno qui.
const PROVENIENZE = {
  google: 'Da Google',
  instagram: 'Da Instagram',
  facebook: 'Da Facebook',
  maps: 'Da Google Maps',
  qr: 'Dal QR stampato in gelateria',
  diretto: 'Diretti (hanno scritto l’indirizzo o l’avevano salvato)',
  altro: 'Da un altro sito',
};

const PAGINE = {
  home: 'Home — la pagina principale',
  galleria: 'Galleria delle foto',
  consegna: 'Consegna a domicilio',
  allergeni: 'Carta degli allergeni',
  altro: 'Altre pagine',
};

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');
const pct = (n, tot) => (tot > 0 ? Math.round((Number(n) || 0) * 100 / tot) : 0);

const giornoBreve = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
};

const giornoLungo = (iso) => {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  } catch {
    return iso;
  }
};

const quando = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

/** Confronto col periodo precedente di pari durata. */
function Delta({ ora, prima }) {
  if (!prima) return ora > 0 ? <span className="stat-delta su">nuovo</span> : null;
  const p = Math.round(((ora - prima) / prima) * 100);
  if (p === 0) return <span className="stat-delta">come prima</span>;
  return (
    <span className={`stat-delta ${p > 0 ? 'su' : 'giu'}`}>
      {p > 0 ? '+' : '−'}{Math.abs(p)}%
    </span>
  );
}

/** Uno dei numeri grossi in cima. */
function Numero({ valore, etichetta, spiega, ora, prima, delta = true, comePrima = fmt }) {
  return (
    <div className="stat-kpi">
      <span className="stat-kpi-num">{valore}</span>
      <span className="stat-kpi-lab">{etichetta}</span>
      <span className="stat-kpi-hint">{spiega}</span>
      <span className="stat-kpi-sotto">
        {delta && <Delta ora={ora} prima={prima} />}
        {Number.isFinite(prima) && <span>prima {comePrima(prima)}</span>}
      </span>
    </div>
  );
}

/**
 * Un elenco con la barretta proporzionale dietro al testo. Niente tabelle: in
 * tutta la dashboard non ce n'è una, e su un telefono sarebbero illeggibili.
 */
function Elenco({ righe, vuoto, base }) {
  if (!righe.length) return <p className="adm-muted">{vuoto}</p>;
  const max = base || Math.max(1, ...righe.map((r) => r.valore));
  return (
    <ul className="stat-lista">
      {righe.map((r) => (
        <li key={r.chiave} className={`stat-riga${r.forte ? ' stat-riga-forte' : ''}`}>
          <span className="stat-riga-fill" style={{ width: `${Math.min(100, pct(r.valore, max))}%` }} aria-hidden="true" />
          <span className="stat-riga-nome">{r.nome}</span>
          {r.extra && <span className="stat-riga-extra">{r.extra}</span>}
          <span className="stat-riga-num">{fmt(r.valore)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StatistichePanel() {
  const [giorni, setGiorni] = useState(30);
  const [dati, setDati] = useState(null);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Barra del grafico toccata: sul telefono il "passaci sopra" non esiste, e
  // senza questo i numeri del grafico non li leggerebbe nessuno.
  const [scelta, setScelta] = useState('');

  // Numero di richiesta: chi torna e non è l'ultimo partito viene ignorato.
  // Senza, passando da 30 a 90 giorni su rete lenta vince la risposta che
  // arriva per ultima, non quella chiesta per ultima: si finisce con la
  // pastiglia "90 giorni" accesa e sotto i numeri di 30 giorni, cioè due cose
  // che si contraddicono nella stessa schermata.
  const richiesta = useRef(0);

  const ricarica = useCallback(async () => {
    const mia = ++richiesta.current;
    setLoaded(false);
    // Il numero mostrato accanto alle barre appartiene al periodo di prima:
    // va spento, se no per un istante si legge sotto il periodo sbagliato.
    setScelta('');
    try {
      const { data, error } = await riepilogo(giorni);
      if (mia !== richiesta.current) return; // sorpassata: la sua risposta non vale più
      // Migrazione non ancora eseguita: si dice quale file lanciare, non
      // l'errore in inglese di Postgres.
      setErr(daConfigurare(error)
        ? 'Scheda non ancora attiva: esegui su Supabase la migrazione migrations/2026-08-12-statistiche-sito.sql.'
        : error || '');
      setDati(data || null);
    } catch (e) {
      if (mia !== richiesta.current) return;
      setErr('Non riesco a leggere le statistiche.');
      setDati(null);
    } finally {
      // Nel finally e non in fondo: se riepilogo() rifiutasse invece di
      // restituire {error}, la scheda resterebbe su "Caricamento…" per sempre,
      // ed è l'unico modo in cui questo pannello può bloccarsi.
      if (mia === richiesta.current) setLoaded(true);
    }
  }, [giorni]);

  useEffect(() => { ricarica(); }, [ricarica]);

  const v = useMemo(() => {
    const eventi = Array.isArray(dati?.eventi) ? dati.eventi : [];
    const ora = dati?.sintesi?.ora || {};
    const prima = dati?.sintesi?.prima || {};
    const n = (x) => Number(x) || 0;

    const riga = (e) => ({ chiave: e.chiave, nome: e.etichetta || e.chiave, valore: n(e.conteggio) });
    const trova = (chiave) => eventi.find((e) => e.chiave === chiave);
    const conPrefisso = (p) => eventi.filter((e) => String(e.chiave || '').startsWith(p));
    // Alcuni eventi possono non essere a catalogo (spenti, o aggiunti dopo):
    // spariscono dall'elenco invece di comparire come riga fantasma.
    const inOrdine = (chiavi) => chiavi.map(trova).filter(Boolean).map(riga);
    const perGruppo = (...gruppi) => eventi
      .filter((e) => gruppi.includes(e.gruppo))
      .map(riga)
      .sort((a, b) => b.valore - a.valore);

    // Percentuale dal telefono: su tutto quello che ci fanno, non solo sulle
    // visite. Se non è successo niente resta vuota invece di dire "0%".
    const daTelefono = (s) => (n(s.eventi) > 0 ? Math.round((n(s.da_telefono) * 100) / n(s.eventi)) : null);

    const provenienze = (Array.isArray(dati?.provenienze) ? dati.provenienze : [])
      .map((p) => ({
        chiave: p.voce || 'altro',
        nome: PROVENIENZE[p.voce] || PROVENIENZE.altro,
        valore: n(p.conteggio),
      }))
      .sort((a, b) => b.valore - a.valore);

    const pagine = (Array.isArray(dati?.pagine) ? dati.pagine : [])
      .map((p) => ({ chiave: p.voce || 'altro', nome: PAGINE[p.voce] || PAGINE.altro, valore: n(p.conteggio) }))
      .sort((a, b) => b.valore - a.valore);

    const passi = conPrefisso('torta_passo_')
      .sort((a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0))
      .map(riga);
    // Base dell'imbuto: il passo più alto, non il primo. Se un domani il primo
    // passo cambia nome le percentuali restano sensate.
    const iniziate = Math.max(0, ...passi.map((p) => p.valore));

    const aperture = conPrefisso('torta_apre_')
      .map((e) => ({
        ...riga(e),
        // Le tre diete meritano l'occhio: dicono cosa comprare.
        forte: ['torta_apre_senza_glutine', 'torta_apre_senza_lattosio', 'torta_apre_vegana'].includes(e.chiave),
      }))
      .sort((a, b) => b.valore - a.valore);

    return {
      totale: n(ora.eventi),
      visite: { ora: n(ora.visite), prima: n(prima.visite) },
      contatti: { ora: n(ora.contatti), prima: n(prima.contatti) },
      mappe: { ora: n(ora.mappe), prima: n(prima.mappe) },
      torte: { ora: n(ora.torte_pagate), prima: n(prima.torte_pagate) },
      mobile: daTelefono(ora),
      mobilePrima: daTelefono(prima),
      settimanale: dati?.passo === 'settimana',
      barre: (Array.isArray(dati?.andamento) ? dati.andamento : []).map((g) => ({
        giorno: g.giorno,
        visite: n(g.visite),
        contatti: n(g.contatti),
      })),
      comeContattano: perGruppo('contatti', 'vendita', 'social'),
      contenuti: perGruppo('contenuti'),
      provenienze,
      totProvenienze: provenienze.reduce((t, p) => t + p.valore, 0),
      pagine,
      totPagine: pagine.reduce((t, p) => t + p.valore, 0),
      aperture,
      passi,
      iniziate,
      esiti: inOrdine([
        'torta_checkout_avviato',
        'torta_pagamento_ok',
        'torta_pagamento_annullato',
        'torta_checkout_errore',
      ]),
      scelte: inOrdine([
        'torta_ritiro',
        'torta_domicilio',
        'torta_extra_visti',
        'torta_extra_aggiunti',
        'torta_extra_rifiutati',
        'torta_sorprendimi',
        'torta_consigliata',
        'torta_allergeni_aperti',
        'torta_sconto_ok',
        'torta_sconto_ko',
        'torta_chiusa',
      ]),
    };
  }, [dati]);

  const pronto = loaded && !err;
  const vuoto = pronto && v.totale === 0;
  const periodo = dati?.dal && dati?.al && dati.dal !== dati.al
    ? `dal ${giornoLungo(dati.dal)} al ${giornoLungo(dati.al)}`
    : dati?.al
      ? `di oggi, ${giornoLungo(dati.al)}`
      : '';

  // Grafico: barre in CSS, nessuna libreria. Le due serie stanno sulla stessa
  // scala (i contatti sono sempre pochi rispetto alle visite: è giusto che si
  // veda), con un minimo di altezza perché un giorno con 1 contatto non sparisca.
  // La scala NON è il massimo secco. Con un massimo secco basta un solo giorno
  // anomalo — una giornata di ferragosto, o qualcuno che si diverte a ricaricare
  // la pagina — perché tutti gli altri giorni finiscano schiacciati al minimo
  // del 3%: 29 barre diventano una fila di puntini e si vede solo la colonna
  // fuori scala, cioè il grafico smette di raccontare l'andamento proprio
  // quando serve. Si prende allora il 90° percentile come riferimento, e solo
  // se il massimo lo sfonda di molto: nei casi normali la scala resta quella
  // di prima, identica.
  const valori = v.barre.map((b) => Math.max(b.visite, b.contatti)).sort((a, b) => a - b);
  const massimo = Math.max(1, valori[valori.length - 1] || 0);
  const p90 = valori.length ? valori[Math.floor(valori.length * 0.9)] || massimo : massimo;
  const maxBarra = massimo > p90 * 2 ? Math.max(1, p90) : massimo;
  const altezza = (n) => (n <= 0 ? 0 : Math.max(3, Math.min(100, Math.round((n * 100) / maxBarra))));
  // Le barre che sfondano il riferimento vanno segnate, se no il grafico
  // mentirebbe al contrario: sembrerebbero pari al giorno migliore.
  const fuoriScala = (n) => n > maxBarra;
  // Se non si è toccato niente (o si è appena cambiato periodo) si legge
  // l'ultima barra: è il giorno che interessa di più.
  const barraScelta = v.barre.find((b) => b.giorno === scelta) || v.barre[v.barre.length - 1] || null;
  const titoloBarra = (b) => {
    const testa = v.settimanale ? `Settimana del ${giornoBreve(b.giorno)}` : giornoBreve(b.giorno);
    return `${testa}: ${fmt(b.visite)} visite · ${fmt(b.contatti)} contatti`;
  };

  return (
    <div className="doc-wrap">
      <section className="adm-card">
        <header className="adm-card-head">
          <div>
            <h3>📊 Statistiche del sito</h3>
            <p>
              Quanta gente apre il sito e cosa ci clicca. Sono conteggi anonimi: non sappiamo
              <em> chi</em> è stato, solo <em>quante volte</em> è successo.
            </p>
          </div>
          {pronto && !vuoto && <span className="adm-count">{fmt(v.totale)} click contati</span>}
        </header>

        <div className="stat-barra">
          <div className="ord-filters">
            {PERIODI.map((p) => (
              <button
                key={p.giorni}
                type="button"
                className={giorni === p.giorni ? 'active' : ''}
                onClick={() => setGiorni(p.giorni)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="adm-btn stat-agg" onClick={ricarica} disabled={!loaded}>
            {loaded ? '↻ Aggiorna' : 'Aggiorno…'}
          </button>
        </div>
        {pronto && periodo && (
          <p className="adm-muted stat-periodo">
            Numeri {periodo}.
            {dati?.ultimo_evento && ` Ultimo dato ricevuto il ${quando(dati.ultimo_evento)}.`}
          </p>
        )}

        {err && <div className="adm-error">⚠️ {err}</div>}
        {!loaded && <div className="adm-muted">Caricamento…</div>}

        {vuoto && (
          <div className="stat-vuoto">
            <span className="stat-vuoto-ico" aria-hidden="true">🍦</span>
            <strong>Ancora nessun dato per questo periodo</strong>
            <p>
              Non è rotto niente: i numeri compaiono man mano che la gente visita il sito. Se hai
              appena acceso le statistiche, dai tempo un giorno o due e riguarda qui — oppure prova
              con un periodo più lungo.
            </p>
          </div>
        )}

        {pronto && !vuoto && (
          <div className="stat-kpis">
            <Numero
              valore={fmt(v.visite.ora)}
              etichetta="Visite al sito"
              spiega="quante volte hanno aperto una pagina"
              ora={v.visite.ora}
              prima={v.visite.prima}
            />
            <Numero
              valore={fmt(v.contatti.ora)}
              etichetta="Ti hanno contattato"
              spiega="WhatsApp e telefono"
              ora={v.contatti.ora}
              prima={v.contatti.prima}
            />
            <Numero
              valore={fmt(v.mappe.ora)}
              etichetta="Hanno chiesto la strada"
              spiega="click sull’indirizzo per la mappa"
              ora={v.mappe.ora}
              prima={v.mappe.prima}
            />
            <Numero
              valore={fmt(v.torte.ora)}
              etichetta="Torte pagate dal sito"
              spiega="tornati sul sito dopo il pagamento"
              ora={v.torte.ora}
              prima={v.torte.prima}
            />
            <Numero
              valore={v.mobile === null ? '—' : `${v.mobile}%`}
              etichetta="Dal telefonino"
              spiega="il resto ti guarda dal computer"
              delta={false}
              prima={v.mobilePrima}
              comePrima={(n) => `${n}%`}
            />
          </div>
        )}
      </section>

      {pronto && !vuoto && (
        <>
          {v.barre.length > 1 && (
            <section className="adm-card">
              <header className="adm-card-head">
                <div>
                  <h3>📈 Come è andata {v.settimanale ? 'settimana per settimana' : 'giorno per giorno'}</h3>
                  <p>
                    {v.settimanale
                      ? 'Una barra per settimana. Toccane una per leggere i suoi numeri.'
                      : 'Una barra per giorno. Toccane una per leggere i suoi numeri.'}
                  </p>
                </div>
                <span className="adm-count">
                  massimo {fmt(maxBarra)}
                  <span className="adm-count-detail"> {v.settimanale ? 'in una settimana' : 'in un giorno'}</span>
                </span>
              </header>

              <div className="stat-legenda">
                <span><i className="stat-punto stat-punto-visite" aria-hidden="true" /> Visite</span>
                <span><i className="stat-punto stat-punto-contatti" aria-hidden="true" /> Ti hanno contattato</span>
              </div>

              {barraScelta && <p className="stat-tip">{titoloBarra(barraScelta)}</p>}

              {/* Il contenitore scorre di lato sui telefoni stretti: con 30
                  giorni su uno schermo da 360px ogni colonna sarebbe larga 9px,
                  e "toccane una per leggere i suoi numeri" diventerebbe una
                  presa in giro. Meglio far scorrere il grafico che rimpicciolire
                  le colonne sotto al dito. */}
              <div className="stat-grafico-scroll">
                <div className="stat-grafico" role="group" aria-label="Andamento nel tempo">
                  {v.barre.map((b) => (
                    <button
                      key={b.giorno}
                      type="button"
                      // L'evidenza si accende solo se l'ha scelta lui: accesa di
                      // suo sembrerebbe una barra pallida in più.
                      className={`stat-col${scelta === b.giorno ? ' sel' : ''}`}
                      title={titoloBarra(b)}
                      aria-label={titoloBarra(b)}
                      onClick={() => setScelta(b.giorno)}
                    >
                      <span
                        className={`stat-col-visite${fuoriScala(b.visite) ? ' oltre' : ''}`}
                        style={{ height: `${altezza(b.visite)}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className={`stat-col-contatti${fuoriScala(b.contatti) ? ' oltre' : ''}`}
                        style={{ height: `${altezza(b.contatti)}%` }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="stat-asse">
                <span>{giornoBreve(dati?.dal || v.barre[0].giorno)}</span>
                <span>{giornoBreve(dati?.al || v.barre[v.barre.length - 1].giorno)}</span>
              </div>
            </section>
          )}

          <section className="adm-card">
            <header className="adm-card-head">
              <div>
                <h3>💬 Come ti cercano</h3>
                <p>
                  Quale bottone usano per scriverti, chiamarti o ordinare. Serve a capire cosa
                  tenere bene in vista e cosa invece non guarda nessuno.
                </p>
              </div>
              <span className="adm-count">{fmt(v.comeContattano.reduce((t, r) => t + r.valore, 0))} in tutto</span>
            </header>
            <Elenco
              righe={v.comeContattano}
              vuoto="Nessuno ha ancora toccato questi bottoni in questo periodo."
            />
          </section>

          <section className="adm-card">
            <header className="adm-card-head">
              <div>
                <h3>🧭 Da dove arrivano</h3>
                <p>
                  Chi apre il sito, da dove ci è arrivato. Il <strong>QR in gelateria</strong> è il
                  numero che dice se i cartellini sui tavoli servono davvero.
                </p>
              </div>
            </header>
            <Elenco
              righe={v.provenienze.map((p) => ({ ...p, extra: `${pct(p.valore, v.totProvenienze)}%` }))}
              vuoto="Ancora nessuna visita in questo periodo."
            />
          </section>

          <section className="adm-card">
            <header className="adm-card-head">
              <div>
                <h3>📄 Cosa guardano</h3>
                <p>Le pagine più aperte e i punti del sito su cui cliccano di più.</p>
              </div>
            </header>
            <Elenco
              righe={v.pagine.map((p) => ({ ...p, extra: `${pct(p.valore, v.totPagine)}%` }))}
              vuoto="Ancora nessuna pagina aperta in questo periodo."
            />
            {v.contenuti.length > 0 && (
              <>
                <h4 className="adm-sub">Cosa cliccano dentro il sito</h4>
                <Elenco righe={v.contenuti} vuoto="Ancora niente." />
              </>
            )}
          </section>

          <section className="adm-card">
            <header className="adm-card-head">
              <div>
                <h3>🎂 Torte: dove si fermano</h3>
                <p>
                  Chi apre "Crea la tua torta" e fin dove arriva. Il passo in cui il numero crolla
                  è quello da sistemare: lì la gente si stufa e se ne va.
                </p>
              </div>
              <span className="adm-count">
                {fmt(v.iniziate)} iniziate
                <span className="adm-count-detail"> · {fmt(v.torte.ora)} pagate</span>
              </span>
            </header>

            <h4 className="adm-sub">Da dove partono</h4>
            <Elenco
              righe={v.aperture}
              vuoto="Nessuno ha aperto la creazione torte in questo periodo."
            />

            <h4 className="adm-sub">Passo per passo</h4>
            <Elenco
              righe={v.passi.map((p) => ({
                ...p,
                extra: v.iniziate ? `${pct(p.valore, v.iniziate)}% di chi ha iniziato` : '',
              }))}
              base={v.iniziate}
              vuoto="Ancora nessuna torta iniziata in questo periodo."
            />
            <p className="adm-muted stat-avviso">
              "Base" e "Crumble" non li vedono tutti — compaiono solo per certe torte — quindi è
              normale che i loro numeri siano più bassi di quelli intorno.
            </p>

            {/* Qui NON si mette la percentuale "di chi ha iniziato", e non è una
                dimenticanza. I passi qui sopra si contano una volta sola per
                visita, mentre le voci di questo elenco si contano tutte le volte
                che succedono (chi apre e chiude il configuratore tre volte fa
                tre chiusure) e l'esito del pagamento arriva addirittura da un
                altro caricamento di pagina, al ritorno da Stripe. Sono conteggi
                su scale diverse: rapportarli darebbe numeri tipo "180% di chi ha
                iniziato", che al titolare sembrano — a ragione — un sito rotto.
                Meglio il numero secco. */}
            <h4 className="adm-sub">Come va a finire</h4>
            <Elenco
              righe={v.esiti}
              vuoto="Nessuno è ancora arrivato al pagamento in questo periodo."
            />
            <p className="adm-muted stat-avviso">
              Qui si contano le volte, non le persone: chi apre e richiude la creazione torte
              due volte conta due chiusure. Per questo non c'è la percentuale.
            </p>

            <h4 className="adm-sub">Le altre scelte</h4>
            <Elenco righe={v.scelte} vuoto="Ancora niente." />
          </section>
        </>
      )}

      {pronto && (
        <footer className="stat-note adm-muted">
          <p>
            Contiamo i <strong>click</strong>, non le persone: chi apre il sito due volte conta due
            volte. Nessun cookie, nessun nome, nessun numero di telefono: solo conteggi.
          </p>
          <p>
            Sono numeri <strong>indicativi</strong>: qualche visitatore blocca le statistiche e
            qualcun altro potrebbe gonfiarle, quindi possono discostarsi dal reale.
          </p>
          <p>
            Il numero vero degli ordini è nella scheda <strong>Ordini</strong>. Qui "torte pagate"
            conta solo chi è tornato sul sito dopo aver pagato: chi chiude la pagina di Stripe prima
            di tornare non compare.
          </p>
        </footer>
      )}
    </div>
  );
}
