/**
 * Regole del modulo «Collabora con noi». Niente React e nessun import, così
 * si provano con Node: node --test src/lib/collaboraRegole.test.mjs
 *
 * Sono le STESSE regole della funzione SQL `invia_collaborazione`
 * (migrations/2026-10-09-collabora-con-noi.sql). Qui servono solo a dire
 * subito, sotto al campo, cosa non va: il controllo che conta lo rifà il
 * database, perché dal browser chiunque può mandare quello che vuole.
 * Se cambi una regola qui, cambiala anche là (e viceversa).
 *
 * Non vanno importate nel configuratore anche se l'email si controlla quasi
 * allo stesso modo (qui in più si rifiutano le emoji): quel file lo stanno
 * cambiando altre persone, e le due regole si possono unire con calma dopo.
 */

/**
 * Chi scrive: è anche l'elenco chiuso del database. Le voci dicono CHI è la
 * persona, non un servizio che offriamo: il sito non deve promettere
 * forniture o eventi che i titolari non hanno deciso di fare.
 * Il database accetta anche 'lavoro' (candidature), che qui di proposito non
 * c'è: le candidature hanno regole privacy loro e nessuno ha chiesto di
 * riceverle. Per accenderlo basta aggiungere
 *   { id: 'lavoro', etichetta: 'Lavorare con noi' }
 * e aggiornare l'informativa privacy.
 */
export const TIPI = Object.freeze([
  { id: 'locale', etichetta: 'Ristorante, bar o locale' },
  { id: 'eventi', etichetta: 'Eventi e feste' },
  { id: 'aziende', etichetta: 'Aziende' },
  { id: 'creator', etichetta: 'Creator e social' },
  { id: 'fornitore', etichetta: 'Fornitore' },
  { id: 'altro', etichetta: 'Altro' },
]);

/** Etichetta di un tipo, anche di quelli che il modulo non propone più. */
export function etichettaTipo(id) {
  if (id === 'lavoro') return 'Lavorare con noi';
  return TIPI.find((t) => t.id === id)?.etichetta || 'Altro';
}

export const MSG_MIN = 20;
export const MSG_MAX = 2000;
// Lunghezze massime: le stesse dei vincoli della tabella.
export const LIMITI = Object.freeze({ nome: 120, azienda: 160, email: 254, telefono: 40, messaggio: MSG_MAX });

// Sotto questo tempo il database considera l'invio fatto da un programma.
export const MS_MINIMI = 3000;

/** Una riga sola: caratteri di controllo e spazi multipli (anche gli a capo) diventano uno spazio. */
export const pulito = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();

/**
 * Il messaggio tiene gli a capo (è il modo in cui la gente scrive) ma perde
 * gli altri caratteri di controllo e gli spazi in testa e in coda.
 */
export const testoMessaggio = (s) => String(s ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
  .trim();

/**
 * Un carattere oltre U+FFFF: quasi sempre un'emoji. In JavaScript occupa due
 * "mezzi caratteri" (surrogati), quindi basta trovarne uno.
 */
const OLTRE_FFFF = /[\uD800-\uDFFF]/;

/**
 * La regola del configuratore (CakeConfigurator.jsx) più due, uguali a quelle
 * della funzione SQL:
 *   · niente emoji: in un indirizzo vero non ci sono (di solito le mette la
 *     tastiera del telefono) e a chi risponde dalla dashboard darebbero un
 *     indirizzo che non arriva a nessuno;
 *   · i caratteri di controllo valgono come spazi, come nel database: in
 *     mezzo all'indirizzo lo rendono sbagliato, in testa e in coda spariscono.
 */
export const emailOk = (s) => {
  const t = pulito(s);
  return t.length <= LIMITI.email && !OLTRE_FFFF.test(t) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
};

/**
 * Facoltativo; se c'è, da 6 a 15 cifre. Più largo del configuratore (lì
 * servono 10 cifre): qui scrivono anche locali col fisso (059…) e fornitori
 * dall'estero.
 */
export const telefonoOk = (s) => {
  const t = pulito(s);
  if (!t) return true;
  const n = t.replace(/\D/g, '').length;
  return n >= 6 && n <= 15;
};

/** Ordine dei campi nel modulo: il primo sbagliato riceve il cursore. */
export const ORDINE_CAMPI = Object.freeze(['tipo', 'nome', 'azienda', 'email', 'telefono', 'messaggio', 'privacy']);

/** { campo: messaggio } per ogni campo da correggere; {} se è tutto a posto. */
export function errori(v) {
  const e = {};
  if (!TIPI.some((t) => t.id === v.tipo)) e.tipo = 'Scegli di cosa si tratta.';
  if (pulito(v.nome).length < 2) e.nome = 'Scrivi nome e cognome.';
  if (!emailOk(v.email)) {
    const t = String(v.email ?? '').trim();
    e.email = !t
      ? 'Scrivi la tua email: ti rispondiamo lì.'
      : OLTRE_FFFF.test(t)
        ? 'Controlla l’email: un indirizzo non può contenere emoji.'
        : 'Controlla l’email: sembra incompleta.';
  }
  if (!telefonoOk(v.telefono)) e.telefono = 'Controlla il numero (oppure lascialo vuoto).';
  const m = testoMessaggio(v.messaggio).length;
  if (m === 0) e.messaggio = 'Raccontaci la tua idea.';
  else if (m < MSG_MIN) e.messaggio = `Raccontaci qualcosa in più (almeno ${MSG_MIN} caratteri).`;
  else if (m > MSG_MAX) e.messaggio = `Al massimo ${MSG_MAX} caratteri.`;
  if (v.privacy !== true) e.privacy = 'Serve la spunta: conferma di aver letto l’informativa privacy.';
  return e;
}

/** Il primo campo da correggere, nell'ordine del modulo. */
export const primoErrore = (e) => ORDINE_CAMPI.find((k) => e && e[k]) || null;

/** Argomenti della funzione invia_collaborazione, già ripuliti. */
export function parametri(v, msDaApertura) {
  const ms = Number.isFinite(msDaApertura) ? Math.round(msDaApertura) : null;
  return {
    p_tipo: v.tipo,
    p_nome: pulito(v.nome),
    p_azienda: pulito(v.azienda) || null,
    p_email: String(v.email ?? '').trim(),
    p_telefono: pulito(v.telefono) || null,
    p_messaggio: testoMessaggio(v.messaggio),
    p_privacy: v.privacy === true,
    p_sito: String(v.sito ?? '').trim() || null, // trappola: un umano non la vede
    // Postgres lo vuole intero e "integer": oltre un'ora non serve distinguere.
    p_ms: ms === null ? null : Math.max(0, Math.min(ms, 3_600_000)),
  };
}

/** Il messaggio quando non si sa cosa è andato storto (rete, server, migrazione mancante). */
export const NON_INVIATA = 'Non siamo riusciti a inviare la proposta. Riprova tra poco, oppure mandacela su WhatsApp: quello che hai scritto è ancora qui.';

/**
 * Cosa fa il modulo con la risposta del database ({ ok, gia_ricevuta, campo, motivo }):
 *   fase          'fatto' (al posto del modulo compare il grazie) o 'modulo'
 *   giaRicevuta   la stessa proposta era già arrivata (doppio tocco)
 *   conta         true = è una proposta nuova: si conta nelle statistiche
 *   erroriServer  { campo: motivo } da mostrare sotto quel campo
 *   avviso        errore che non riguarda un campo (riquadro + WhatsApp)
 *   campo         il campo su cui portare il cursore, o null
 */
export function dopoRisposta(r) {
  if (r && r.ok === true) {
    const gia = r.gia_ricevuta === true;
    return { fase: 'fatto', giaRicevuta: gia, conta: !gia, erroriServer: {}, avviso: '', campo: null };
  }
  const motivo = (r && typeof r.motivo === 'string' && r.motivo) || NON_INVIATA;
  const campo = r && ORDINE_CAMPI.includes(r.campo) ? r.campo : null;
  return campo
    ? { fase: 'modulo', giaRicevuta: false, conta: false, erroriServer: { [campo]: motivo }, avviso: '', campo }
    : { fase: 'modulo', giaRicevuta: false, conta: false, erroriServer: {}, avviso: motivo, campo: null };
}

/** /collabora?tipo=eventi sceglie già il tipo (solo se esiste). */
export function tipoDaRicerca(search) {
  try {
    const t = new URLSearchParams(search || '').get('tipo');
    return TIPI.some((x) => x.id === t) ? t : '';
  } catch {
    return '';
  }
}

/* ───────── Link ───────── */

export const WHATSAPP_NUMERO = '393203306009';
export const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMERO}`;

/**
 * encodeURIComponent che non lancia mai. Quello del browser lancia un errore
 * (URIError) se trova mezza emoji, cioè un surrogato rimasto da solo dopo un
 * taglio; e un errore mentre si disegna un link fa sparire tutta la pagina
 * (il modulo con quello che la persona ha scritto, o l'intera dashboard).
 * Le metà spaiate diventano U+FFFD (il punto di domanda nel rombo), tutto
 * il resto si codifica come sempre.
 */
export function perUrl(s) {
  const t = String(s ?? '');
  try {
    return encodeURIComponent(t);
  } catch {
    // Array.from divide per caratteri veri: un'emoji intera resta intera,
    // un surrogato spaiato resta da solo (lungo 1) e si riconosce.
    return encodeURIComponent(Array.from(t, (c) => (OLTRE_FFFF.test(c) && c.length === 1 ? '\uFFFD' : c)).join(''));
  }
}

/**
 * WhatsApp con la proposta già scritta: è la strada di riserva quando il
 * modulo non riesce a inviare (Supabase giù, migrazione non ancora lanciata,
 * troppe proposte). Così quello che la persona ha scritto non va perso.
 */
export function linkWhatsapp(v) {
  const righe = ['Ciao! Vi scrivo dalla pagina «Collabora con noi» del sito.'];
  const tipo = TIPI.find((t) => t.id === v?.tipo);
  if (tipo) righe.push(`Di cosa si tratta: ${tipo.etichetta}`);
  const nome = pulito(v?.nome);
  if (nome) righe.push(`Nome: ${nome}`);
  const azienda = pulito(v?.azienda);
  if (azienda) righe.push(`Azienda o locale: ${azienda}`);
  const msg = testoMessaggio(v?.messaggio);
  if (msg) {
    // Il taglio si fa per caratteri veri (Array.from), non con slice: slice
    // conta i mezzi caratteri e potrebbe spezzare un'emoji a metà.
    const caratteri = Array.from(msg);
    righe.push('', caratteri.length > 1500 ? `${caratteri.slice(0, 1500).join('')}…` : msg);
  }
  return `${WHATSAPP_URL}&text=${perUrl(righe.join('\n'))}`;
}

/** Per la dashboard: risposta via email con oggetto e saluto già scritti. */
export function linkEmail(email, nome) {
  // L'indirizzo resta leggibile; si codificano solo i caratteri che
  // romperebbero il link (?, &, #, spazi…). La "u" fa arrivare un'emoji
  // intera alla codifica, non le sue due metà una alla volta.
  const indirizzo = String(email ?? '').trim().replace(/[^A-Za-z0-9@._+-]/gu, (c) => perUrl(c));
  const primo = pulito(nome).split(' ')[0];
  const corpo = `${primo ? `Ciao ${primo},` : 'Ciao,'}\r\n\r\n`;
  return `mailto:${indirizzo}?subject=${perUrl('La tua proposta a Gelateria Punto Gi')}&body=${perUrl(corpo)}`;
}

/** tel: con le sole cifre (e il + iniziale, se c'era). */
export function linkTelefono(tel) {
  const t = String(tel ?? '').trim();
  const cifre = t.replace(/\D/g, '');
  if (cifre.length < 6) return null;
  return `tel:${t.startsWith('+') ? '+' : ''}${cifre}`;
}

/**
 * WhatsApp solo per i cellulari italiani (3xx…): per un fisso o un numero
 * estero il link aprirebbe una chat che non esiste.
 */
export function linkWhatsappTelefono(tel) {
  let d = String(tel ?? '').replace(/\D/g, '');
  if (d.startsWith('0039')) d = d.slice(4);
  else if (d.startsWith('39') && d.length >= 11) d = d.slice(2);
  return /^3\d{8,9}$/.test(d) ? `https://api.whatsapp.com/send?phone=39${d}` : null;
}
