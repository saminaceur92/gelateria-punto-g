// Promemoria compleanno e anniversario: le regole "pure" (niente Supabase,
// niente React), così si provano da sole con
//   node --test src/lib/promemoriaRegole.test.mjs
// Le regole sulle occasioni e sulla "stessa festa" DEVONO combaciare con
// quelle del database (migrations/2026-10-09-promemoria-ricorrenze.sql:
// promemoria_occasione e promemoria_stessa_ricorrenza), altrimenti il sito
// promette una cosa e il database ne fa un'altra.

/**
 * Quali occasioni hanno il promemoria: 'Compleanno' | 'Anniversario' | null.
 * Confronto "largo", come nel database: "Compleanno 🎂" o "Anniversario di
 * matrimonio" valgono lo stesso, così rinominare l'occasione in dashboard non
 * spegne i promemoria senza che nessuno se ne accorga.
 */
export function occasioneConPromemoria(nome) {
  const s = String(nome ?? '');
  if (/compleann/i.test(s)) return 'Compleanno';
  if (/anniversari/i.test(s)) return 'Anniversario';
  return null;
}

const TESTI = {
  Compleanno: { emoji: '🎂', ricorrenza: 'il compleanno' },
  Anniversario: { emoji: '🥂', ricorrenza: "l'anniversario" },
};

/** Emoji e parole della ricorrenza ('il compleanno' / "l'anniversario"). */
export function testiPromemoria(occasione) {
  return TESTI[occasioneConPromemoria(occasione)] || TESTI.Compleanno;
}

/**
 * Avviso mostrato al cliente quando lascia l'email: la mail dell'anno dopo è
 * promozionale, quindi va detto PRIMA. null = occasione senza promemoria.
 */
export function avvisoPromemoria(occasione) {
  const occ = occasioneConPromemoria(occasione);
  if (!occ) return null;
  const t = TESTI[occ];
  return `${t.emoji} Tra un anno ti scriveremo qui per ricordarti ${t.ricorrenza}, con la torta che hai scelto oggi. Ti basterà un clic per non riceverlo più.`;
}

const TOKEN = /^[0-9a-f]{32}$/i;

/**
 * Link dalla mail del promemoria:
 *   ?togli=<token>  «non ricordarmi più questa ricorrenza» (solo quella festa)
 *   ?stop=<token>   «non voglio più nessun promemoria» (tutto l'indirizzo)
 * Il token 'prova' arriva dalle copie di prova mandate dal gestionale: la
 * pagina mostra com'è fatta ma non tocca il database.
 * Risposta: { modo, token, prova } — token null e prova false = link rovinato.
 * null = nessun link di promemoria nell'indirizzo.
 */
export function leggiLinkPromemoria(search) {
  let p;
  try {
    p = new URLSearchParams(search || '');
  } catch {
    return null;
  }
  for (const modo of ['togli', 'stop']) {
    if (!p.has(modo)) continue;
    const t = (p.get(modo) || '').trim();
    if (t.toLowerCase() === 'prova') return { modo, token: null, prova: true };
    if (TOKEN.test(t)) return { modo, token: t.toLowerCase(), prova: false };
    return { modo, token: null, prova: false };
  }
  return null;
}

const giorno = (iso) => Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
const piuGiorni = (iso, n) => new Date(giorno(iso) + n * 86400000).toISOString().slice(0, 10);

/**
 * La data della festa da ricordare. Dopo la migrazione la dice il database;
 * prima la si ricava dalla data d'invio (30 o 14 giorni prima).
 */
export function anniversarioDi(riga) {
  if (riga?.anniversario) return String(riga.anniversario).slice(0, 10);
  if (!riga?.invio_previsto) return null;
  return piuGiorni(riga.invio_previsto, riga.tipo === 'primo' ? 30 : 14);
}

/**
 * Due schede parlano della STESSA festa: stesso ordine, oppure stessa email,
 * stessa occasione e date a 3 giorni o meno (come promemoria_stessa_ricorrenza).
 */
export function stessaRicorrenza(a, b) {
  if (a.ordineId === b.ordineId) return true;
  if (!a.anniversario || !b.anniversario) return false;
  return a.email === b.email && a.occasione === b.occasione
    && Math.abs(giorno(a.anniversario) - giorno(b.anniversario)) <= 3 * 86400000;
}

const ORDINE_TIPO = { primo: 0, secondo: 1 };

/**
 * Righe della coda → una scheda per ordine (cioè per festa), con le sue due
 * mail in ordine (30 giorni prima, poi 14).
 * - `attiva`: c'è ancora qualcosa da spedire o da sistemare (in coda o in errore);
 * - `doppione`: un'altra scheda è la stessa festa (doppio ordine): il
 *   database ne manda comunque una sola, il badge serve a capirlo a colpo d'occhio.
 * Prima le schede attive (dalla prossima mail), poi lo storico (più recenti prima).
 */
export function raggruppaPromemoria(rows) {
  const per = new Map();
  for (const r of rows || []) {
    if (!per.has(r.ordine_id)) {
      per.set(r.ordine_id, {
        ordineId: r.ordine_id,
        email: r.email,
        nome: r.nome,
        occasione: occasioneConPromemoria(r.occasione) || 'Compleanno',
        anniversario: anniversarioDi(r),
        righe: [],
      });
    }
    per.get(r.ordine_id).righe.push(r);
  }
  const schede = [...per.values()];
  for (const s of schede) {
    s.righe.sort((a, b) => (ORDINE_TIPO[a.tipo] ?? 2) - (ORDINE_TIPO[b.tipo] ?? 2));
    s.attiva = s.righe.some((r) => r.stato === 'in_attesa' || r.stato === 'errore');
    s.prossima = s.righe
      .filter((r) => r.stato === 'in_attesa' || r.stato === 'errore')
      .map((r) => r.invio_previsto)
      .sort()[0] || null;
    s.ultima = s.righe
      .map((r) => String(r.inviato_il || r.invio_previsto || ''))
      .sort()
      .pop() || '';
  }
  for (const s of schede) {
    s.doppione = schede.some((o) => o !== s && stessaRicorrenza(o, s));
  }
  return schede.sort((a, b) => {
    if (a.attiva !== b.attiva) return a.attiva ? -1 : 1;
    if (a.attiva) return String(a.prossima).localeCompare(String(b.prossima));
    return b.ultima.localeCompare(a.ultima);
  });
}

/**
 * Si può proporre «Rimetti in coda»? Mai per una mail già partita, mai per
 * una che il cliente ha chiesto di togliere, mai per un disiscritto (lì si
 * riattiva l'indirizzo). Il database ricontrolla comunque tutto.
 */
export function puoRimettere(riga) {
  if (riga.stato !== 'annullato' && riga.stato !== 'errore') return false;
  if (riga.stato === 'annullato' && riga.inviato_il) return false;
  const nota = riga.nota || '';
  if (nota.startsWith('tolto dal cliente')) return false;
  if (nota === 'disiscritto') return false;
  return true;
}
