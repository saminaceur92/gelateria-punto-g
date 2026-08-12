/**
 * Statistiche di click del sito: first-party, senza cookie, aggregate.
 *
 * Il titolare vuole sapere quante volte gli scrivono su WhatsApp, da dove
 * arriva la gente e a quale passo si ferma chi ordina una torta. Niente di
 * più. Qui non si misurano le persone: si contano i click, e il database
 * somma tutto dentro un contatore per giorno (vedi la migrazione
 * migrations/2026-08-12-statistiche-sito.sql). La riga "un evento, un
 * istante" non esiste mai, quindi non c'è nulla da anonimizzare dopo.
 *
 * Cosa NON facciamo, ed è il punto dell'intero file: non scriviamo e non
 * leggiamo niente dal dispositivo — niente cookie, niente localStorage,
 * niente sessionStorage (per il Garante è archiviazione nel terminale
 * esattamente come un cookie, anche se dura un minuto). Non tocchiamo l'IP,
 * non mandiamo lo user agent, non prendiamo lingua, fuso o risoluzione.
 * Per questo il tracciamento resta fuori dall'obbligo di consenso e non va
 * aggiunto al banner iubenda. Va invece dichiarato nella privacy policy:
 * la trasparenza è dovuta anche quando il consenso non lo è.
 *
 * Tutto è best-effort: se Supabase è giù o le variabili mancano, il sito si
 * comporta in modo identico e la console resta pulita.
 */

// Le stesse variabili di src/lib/supabase.js, ma lette a mano: questo file
// non importa il client. Non è pignoleria — usiamo fetch(keepalive) invece
// di supabase.rpc() perché i click sui link interni (/galleria, /consegna,
// tel:, il PDF allergeni) sono navigazioni nella stessa scheda e una fetch
// normale viene annullata dall'unload: si perderebbero in silenzio proprio
// gli eventi che contano di più. sendBeacon non va bene perché non permette
// gli header apikey/Authorization.
const BASE = import.meta.env.VITE_SUPABASE_URL;
const CHIAVE = import.meta.env.VITE_SUPABASE_KEY;

const ENDPOINT =
  BASE && CHIAVE ? `${String(BASE).replace(/\/+$/, '')}/rest/v1/rpc/registra_evento` : '';

/* ───────── Elenco chiuso degli eventi ─────────
   La stessa lista sta anche a catalogo nel database: se una chiave non è in
   entrambi i posti l'evento viene scartato in silenzio. Aggiungerne uno vuol
   dire tre cose insieme, sempre: riga nel catalogo (migrazione), costante
   qui, punto di chiamata. Il nome è <canale>_<posizione>, e il prefisso è
   struttura, non estetica: la dashboard raggruppa con "like 'whatsapp\\_%'".
   Pagina e mobile/desktop NON stanno nella chiave: sono già colonne. */
export const EV = Object.freeze({
  // Visite
  PAGINA_VISTA: 'pagina_vista',
  QR_ALLERGENI: 'qr_allergeni',

  // Contatti
  WHATSAPP_FAB: 'whatsapp_fab',
  WHATSAPP_CONTATTI: 'whatsapp_contatti',
  WHATSAPP_FOOTER: 'whatsapp_footer',
  WHATSAPP_CONSEGNA: 'whatsapp_consegna',
  WHATSAPP_GALLERIA: 'whatsapp_galleria',
  WHATSAPP_POST_ORDINE: 'whatsapp_post_ordine',
  TELEFONO: 'telefono',
  MAPPA_CONTATTI: 'mappa_contatti',
  MAPPA_FOOTER: 'mappa_footer',

  // Vendita
  DELIVEROO_CONSEGNA: 'deliveroo_consegna',
  DELIVEROO_GALLERIA: 'deliveroo_galleria',
  GLOVO_CONSEGNA: 'glovo_consegna',
  GLOVO_GALLERIA: 'glovo_galleria',

  // Social
  INSTAGRAM_CONTATTI: 'instagram_contatti',
  INSTAGRAM_FOOTER: 'instagram_footer',
  INSTAGRAM_GALLERIA: 'instagram_galleria',
  INSTAGRAM_POST_ORDINE: 'instagram_post_ordine',
  FACEBOOK_FOOTER: 'facebook_footer',
  FACEBOOK_GALLERIA: 'facebook_galleria',
  FACEBOOK_POST_ORDINE: 'facebook_post_ordine',

  // Torta — da dove si apre il configuratore.
  // Le tre diete restano separate di proposito: dicono cosa comprare.
  TORTA_APRE_HERO: 'torta_apre_hero',
  TORTA_APRE_NAVBAR: 'torta_apre_navbar',
  TORTA_APRE_MENU_MOBILE: 'torta_apre_menu_mobile',
  TORTA_APRE_SERVIZI: 'torta_apre_servizi',
  TORTA_APRE_CTA: 'torta_apre_cta',
  TORTA_APRE_SENZA_GLUTINE: 'torta_apre_senza_glutine',
  TORTA_APRE_SENZA_LATTOSIO: 'torta_apre_senza_lattosio',
  TORTA_APRE_VEGANA: 'torta_apre_vegana',
  TORTA_APRE_PROMEMORIA: 'torta_apre_promemoria',

  // Torta — passi raggiunti (il funnel).
  // Si conta la CHIAVE del passo che entra in scena, mai l'indice numerico:
  // i passi effettivi sono 11, 12 o 13 a seconda della torta, e chi sceglie
  // una torta consigliata salta dritto alla scritta.
  TORTA_PASSO_TIPO: 'torta_passo_tipo',
  TORTA_PASSO_DIMENSIONE: 'torta_passo_dimensione',
  TORTA_PASSO_ALLERGIE: 'torta_passo_allergie',
  TORTA_PASSO_FORMA: 'torta_passo_forma',
  TORTA_PASSO_BASE: 'torta_passo_base',
  TORTA_PASSO_CRUMBLE: 'torta_passo_crumble',
  TORTA_PASSO_GUSTI: 'torta_passo_gusti',
  TORTA_PASSO_FARCITURA: 'torta_passo_farcitura',
  TORTA_PASSO_COPERTURA: 'torta_passo_copertura',
  TORTA_PASSO_DECORAZIONE: 'torta_passo_decorazione',
  TORTA_PASSO_SCRITTA: 'torta_passo_scritta',
  TORTA_PASSO_DATI: 'torta_passo_dati',
  TORTA_PASSO_RIEPILOGO: 'torta_passo_riepilogo',

  // Torta — scelte ed esito.
  // TORTA_SCONTO_OK/KO non portano mai con sé il codice: alcuni sono nominativi.
  TORTA_SORPRENDIMI: 'torta_sorprendimi',
  TORTA_CONSIGLIATA: 'torta_consigliata',
  TORTA_ALLERGENI_APERTI: 'torta_allergeni_aperti',
  TORTA_RITIRO: 'torta_ritiro',
  TORTA_DOMICILIO: 'torta_domicilio',
  TORTA_EXTRA_VISTI: 'torta_extra_visti',
  TORTA_EXTRA_AGGIUNTI: 'torta_extra_aggiunti',
  TORTA_EXTRA_RIFIUTATI: 'torta_extra_rifiutati',
  TORTA_SCONTO_OK: 'torta_sconto_ok',
  TORTA_SCONTO_KO: 'torta_sconto_ko',
  TORTA_CHECKOUT_AVVIATO: 'torta_checkout_avviato',
  TORTA_CHECKOUT_ERRORE: 'torta_checkout_errore',
  TORTA_PAGAMENTO_OK: 'torta_pagamento_ok',
  TORTA_PAGAMENTO_ANNULLATO: 'torta_pagamento_annullato',
  TORTA_CHIUSA: 'torta_chiusa',

  // Contenuti
  NAV_GUSTI: 'nav_gusti',
  NAV_TORTE: 'nav_torte',
  NAV_CONSEGNA: 'nav_consegna',
  NAV_GALLERIA: 'nav_galleria',
  NAV_CONTATTI: 'nav_contatti',
  HERO_SCOPRI_GUSTI: 'hero_scopri_gusti',
  SERVIZIO_CONSEGNA: 'servizio_consegna',
  SERVIZIO_GALLERIA: 'servizio_galleria',
  SERVIZIO_GUSTI: 'servizio_gusti',
  GALLERIA_VEDI_TUTTE: 'galleria_vedi_tutte',
  FOTO_APERTA: 'foto_aperta',
  PREFERISCO_SCRIVERE: 'preferisco_scrivere',

  // Allergeni
  ALLERGENI_NAVBAR: 'allergeni_navbar',
  ALLERGENI_FOOTER: 'allergeni_footer',
  ALLERGENI_PDF: 'allergeni_pdf',
});

/**
 * Dalla chiave di passo del configuratore (STEPS in CakeConfigurator, che è
 * in inglese) all'evento italiano. Sta qui e non là perché la whitelist deve
 * restare in un posto solo: così nessuno può comporre a mano una chiave
 * inventata che il database scarterebbe in silenzio.
 */
export const EV_PASSO = Object.freeze({
  type: EV.TORTA_PASSO_TIPO,
  size: EV.TORTA_PASSO_DIMENSIONE,
  allergies: EV.TORTA_PASSO_ALLERGIE,
  shape: EV.TORTA_PASSO_FORMA,
  base: EV.TORTA_PASSO_BASE,
  crumble: EV.TORTA_PASSO_CRUMBLE,
  flavors: EV.TORTA_PASSO_GUSTI,
  filling: EV.TORTA_PASSO_FARCITURA,
  covering: EV.TORTA_PASSO_COPERTURA,
  decoration: EV.TORTA_PASSO_DECORAZIONE,
  message: EV.TORTA_PASSO_SCRITTA,
  details: EV.TORTA_PASSO_DATI,
  review: EV.TORTA_PASSO_RIEPILOGO,
});

const VALIDI = new Set(Object.values(EV));

/* ───────── Quando NON si traccia ───────── */

const NEL_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

// Lo user agent lo leggiamo qui e solo qui, e solo per SCARTARE i bot: la
// stringa resta in memoria e non finisce in nessuna richiesta. Letto di
// sfuggita sembra una violazione della regola "niente user agent", non lo è.
const PARE_UN_BOT =
  NEL_BROWSER && /bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent || '');

// In produzione si traccia solo sul dominio vero. Il controllo sull'hostname
// spegne da solo le anteprime *.vercel.app, che girano con le stesse env di
// produzione e altrimenti riempirebbero di lavoro nostro i numeri del titolare.
const IN_PRODUZIONE =
  NEL_BROWSER && import.meta.env.PROD && /(^|\.)gelateriapuntogi\.it$/.test(location.hostname);

// In sviluppo (import.meta.env.DEV) è spento: le env locali puntano allo
// stesso progetto Supabase, quindi ogni "npm run dev" sporcherebbe i dati
// veri. Questo flag è l'unica porta per provarlo davvero, e salta anche il
// controllo sul dominio: altrimenti su localhost non servirebbe a niente.
const FORZATO = import.meta.env.VITE_STATISTICHE_DEV === '1';

// La dashboard non è traffico del sito. Il punto di chiamata in main.jsx sta
// già dentro il ramo "if (!isAdmin)", ma il controllo lo teniamo anche qui:
// è quello che nessuno può dimenticarsi aggiungendo una pagina domani.
const IN_ADMIN = NEL_BROWSER && location.pathname.startsWith('/admin');

// ⚠️ Qui dentro ci va solo ciò che NON può cambiare durante la vita della
// pagina. La visibilità della scheda non è di questi: si valuta a ogni evento,
// dentro traccia(). Congelarla qui vorrebbe dire che una pagina aperta in una
// scheda di sfondo (ctrl-click, "apri in nuova scheda", ripristino sessione)
// resta muta per sempre — anche dopo che l'utente ci passa sopra e naviga.
// Si perderebbero la visita E tutti i click successivi, in silenzio e sempre
// nella stessa direzione: proprio il tipo di buco che non si scopre mai.
const ATTIVO =
  NEL_BROWSER &&
  Boolean(ENDPOINT) && // env mancanti: come in supabase.js, si sta zitti
  (IN_PRODUZIONE || FORZATO) &&
  !IN_ADMIN &&
  !navigator.webdriver && // browser pilotato da un test
  !PARE_UN_BOT;

/* ───────── Contesto: pagina, dispositivo, provenienza ───────── */

/** Whitelist di 4 pagine + "altro": l'URL non deve mai diventare un dato libero. */
function paginaCorrente() {
  // Solo pathname. Mai search, mai hash: lì dentro girano i token personali
  // ?torta= e ?stop=. I rewrite /v2…/v8 di vercel.json cadono su "altro", ed
  // è giusto così: meglio una voce generica che un URL salvato in tabella.
  const p = location.pathname;
  if (p.startsWith('/allergeni')) return 'allergeni';
  if (p.startsWith('/galleria')) return 'galleria';
  if (p.startsWith('/consegna')) return 'consegna';
  if (p === '/' || p === '') return 'home';
  return 'altro';
}

/** Due soli valori. Basta al titolare ("quanti mi guardano dal telefono") e non identifica nessuno. */
function dispositivoCorrente() {
  try {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return 'mobile';
  } catch {
    /* matchMedia assente: si guarda solo la larghezza */
  }
  return window.innerWidth < 900 ? 'mobile' : 'desktop';
}

/** Solo l'HOST del referrer, mappato su un'etichetta: mai l'URL intero (può contenere token). */
function provenienzaCorrente() {
  // ?src=qr è l'unico parametro che leggiamo in tutto il file, e serve solo a
  // scegliere un'etichetta: è il QR stampato sui tavoli che porta a /allergeni.
  try {
    if (new URLSearchParams(location.search).get('src') === 'qr') return 'qr';
  } catch {
    /* query malformata: pazienza */
  }

  const rif = document.referrer || '';
  if (!rif) return 'diretto';

  let host = '';
  try {
    host = new URL(rif).hostname.toLowerCase();
  } catch {
    return 'altro';
  }

  if (host === location.hostname) return 'interno';
  if (/(^|\.)maps\.google\./.test(host) || /(^|\.)goo\.gl$/.test(host)) return 'maps';
  if (/(^|\.)google\./.test(host)) return 'google';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)facebook\.com$/.test(host) || /(^|\.)fb\.(com|me)$/.test(host)) return 'facebook';
  return 'altro';
}

// Calcolato una volta sola e poi congelato: il sito non ha router, ogni
// cambio pagina è un caricamento nuovo, quindi non può cambiare a metà vita.
let ctx = null;
function contesto() {
  if (!ctx) {
    ctx = {
      pagina: paginaCorrente(),
      dispositivo: dispositivoCorrente(),
      provenienza: provenienzaCorrente(),
    };
  }
  return ctx;
}

/* ───────── Freni contro i doppioni, tutti in memoria ─────────
   Nessuno di questi tocca localStorage o sessionStorage: sono variabili di
   modulo, muoiono al reload. È il motivo per cui non serve nessun consenso. */

const visti = new Set(); // per tracciaUnaVolta()
const ultimo = new Map(); // evento -> millisecondi dell'ultimo invio
let inviati = 0;
let avviato = false;

const FINESTRA_MS = 800; // doppio tap su mobile, elementi cliccabili annidati
const MAX_PER_PAGINA = 60; // se un loop di rendering impazzisce, ci fermiamo

/* ───────── Invio ───────── */

function invia(evento, c) {
  // Stessa forma di src/lib/log.js: nessun await (aspettare dentro un handler
  // di click ritarderebbe la navigazione), .then(() => {}, () => {}) esplicito
  // perché senza quello una promise rifiutata lascia una unhandled rejection in
  // console quando Supabase è giù, try/catch sincrono per gli errori che fetch
  // tira prima ancora di restituire la promise. E nessun console.error: con il
  // backend irraggiungibile stamperebbe una riga per ogni click.
  try {
    const p = fetch(ENDPOINT, {
      method: 'POST',
      // Sopravvive all'unload: senza, i click sui link interni e su tel: si
      // perderebbero in modo sistematico. Sui browser molto vecchi che non lo
      // supportano quell'evento si perde: accettato.
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: CHIAVE,
        Authorization: `Bearer ${CHIAVE}`,
        // La funzione torna void: chiediamo 204 e basta. Chi sonda non riceve
        // nessun segnale, né in caso di scrittura né in caso di scarto.
        Prefer: 'return=minimal',
      },
      // Quattro stringhe, niente di più. Il giorno, il tipo di evento e il
      // tetto giornaliero li decide il database: qui non si manda mai una data
      // (orologio non fidato) né un conteggio.
      body: JSON.stringify({
        p_evento: evento,
        p_pagina: c.pagina,
        p_dispositivo: c.dispositivo,
        p_provenienza: c.provenienza,
      }),
    });
    if (p && typeof p.then === 'function') p.then(() => {}, () => {});
  } catch {
    /* no-op: se le statistiche non partono, pazienza */
  }
}

/* ───────── API ───────── */

/**
 * Conta un click. Ritorna sempre undefined e non lancia mai.
 *
 * Un solo argomento, di proposito: niente payload libero, niente oggetto
 * "dettagli". Ogni parametro in più è una porta da cui, fra sei mesi, entra
 * un dato personale. Il contesto se lo calcola il modulo.
 */
export function traccia(evento) {
  if (!ATTIVO) return false;
  if (!VALIDI.has(evento)) return false; // chiave sconosciuta: scartata senza rumore
  if (inviati >= MAX_PER_PAGINA) return false;

  // Valutata adesso e non all'avvio: una scheda aperta in secondo piano deve
  // poter iniziare a contare nel momento in cui l'utente ci arriva davvero.
  // Serve comunque a scartare il prerender del browser e le schede mai aperte.
  if (document.visibilityState === 'hidden') return false;

  const ora = Date.now();
  const prec = ultimo.get(evento);
  if (prec !== undefined && ora - prec < FINESTRA_MS) return false;
  ultimo.set(evento, ora);

  inviati += 1;
  invia(evento, contesto());
  return true;
}

/**
 * Come traccia(), ma al massimo una volta per caricamento pagina.
 *
 * Serve a pagina_vista, al QR e ai passi del funnel: tornare indietro e
 * riavanzare non deve gonfiare il passo. Assorbe anche il doppio montaggio
 * di React.StrictMode (che in sviluppo esegue gli effetti due volte).
 */
export function tracciaUnaVolta(evento) {
  if (!ATTIVO || visti.has(evento)) return;
  // Si segna come "già fatto" SOLO se è partito davvero. Marcarlo prima
  // sembra identico e non lo è: traccia() può rifiutare (scheda ancora in
  // secondo piano, tetto di eventi per pagina), e con la marcatura anticipata
  // quel passo del funnel resterebbe perso per sempre in quel caricamento —
  // senza un errore, senza un segno. Sono proprio i passi del configuratore
  // il dato per cui esiste tutto questo lavoro.
  if (traccia(evento)) visti.add(evento);
}

/** Un solo listener per tutto il sito: le CTA si strumentano con data-ev="…". */
function alClick(e) {
  try {
    const el = e.target && e.target.closest ? e.target.closest('[data-ev]') : null;
    if (el) traccia(el.getAttribute('data-ev'));
  } catch {
    /* no-op: il click dell'utente non deve mai risentirne */
  }
}

/**
 * Da chiamare una volta sola, in main.jsx, fuori dal ramo /admin.
 * Chiamarla due volte non fa danni: la seconda esce subito (due listener
 * vorrebbero dire contare doppio).
 */
export function avviaAnalytics() {
  if (!ATTIVO || avviato) return;
  avviato = true;

  const c = contesto();

  // In capture, così vale anche dove un handler chiama stopPropagation.
  // Regola inderogabile: un elemento o ha data-ev o chiama traccia(). Mai
  // tutti e due, o si conta due volte.
  document.addEventListener('click', alClick, { capture: true });

  tracciaUnaVolta(EV.PAGINA_VISTA);
  if (c.provenienza === 'qr') tracciaUnaVolta(EV.QR_ALLERGENI);
}
