/**
 * "Torte già composte" nella scheda Statistiche: i conti e le frasi, senza
 * disegno.
 *
 * Sta in un file a parte e SENZA import per un motivo pratico: così si prova
 * con `node --test src/admin/consigliateStat.test.mjs`, senza Vite e senza
 * database. StatistichePanel importa supabase e analytics.js legge
 * import.meta.env: in Node non partirebbero.
 *
 * Da dove vengono i numeri. Ogni torta consigliata del passo Forma
 * (torteConsigliate in src/data/fallback/cakeOptions.js) ha il suo evento,
 * torta_consigliata_<gruppo>_<id>, e il gruppo sta DENTRO la chiave: è così
 * che qui si divide gelato da semifreddo, leggendo il prefisso come il
 * database fa con 'whatsapp\_%'. Il nome da mostrare è l'etichetta del
 * catalogo (statistiche_eventi), non un testo scritto qui: se cambia, si
 * cambia in un posto solo.
 *
 * Il vecchio evento `torta_consigliata` (una voce sola per tutte le torte,
 * quella usata fino all'ottobre 2026) resta a catalogo: nel totale ci entra,
 * nella divisione e nella classifica no, perché non dice quale torta era.
 * Dividerlo "a occhio" in proporzione sarebbe inventare dei numeri.
 */

export const GENERICO = 'torta_consigliata';
export const PREFISSO = `${GENERICO}_`;

// Stessi titoli dei due tasti del passo Forma (StepShape in
// CakeConfigurator.jsx): il titolare deve ritrovare qui le parole che vede
// il cliente.
export const GRUPPI = [
  { id: 'gelato', nome: '🍦 Torte gelato', icona: '🍦', singolare: 'torta gelato' },
  { id: 'semifreddo', nome: '🍰 Semifreddi', icona: '🍰', singolare: 'semifreddo' },
];

// Oltre tre nomi a pari merito la tessera "La più scelta" diventerebbe un
// elenco: meglio dire quante sono e lasciarle evidenziate negli elenchi.
const MAX_NOMI = 3;

/** Un conteggio: sempre un numero intero >= 0, qualunque cosa arrivi. */
const quanti = (x) => {
  const v = Number(x);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
};

export const fmt = (x) => quanti(x).toLocaleString('it-IT');

/** "1 volta", "3 volte", "1.200 volte". */
export const volte = (x) => `${fmt(x)} ${quanti(x) === 1 ? 'volta' : 'volte'}`;

/** "A", "A e B", "A, B e C". */
export function elencoNomi(nomi) {
  const l = (Array.isArray(nomi) ? nomi : []).filter(Boolean);
  if (l.length <= 1) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`;
}

/**
 * Percentuali intere che fanno SEMPRE 100. Arrotondare ognuna per conto suo
 * può dare 101% (12,5 → 13 e 87,5 → 88), e un titolare che somma due numeri
 * e trova 101 pensa, a ragione, che la scheda sbagli i conti. Il punto che
 * avanza va a chi ha il resto più grande; a parità di resto al numero più
 * piccolo, così 1 su 8 fa 13% in qualunque ordine arrivino i gruppi.
 */
export function percentuali(valori) {
  const v = (Array.isArray(valori) ? valori : []).map(quanti);
  const tot = v.reduce((s, x) => s + x, 0);
  if (!tot) return v.map(() => 0);
  const grezze = v.map((x) => (x * 100) / tot);
  const intere = grezze.map((g) => Math.floor(g));
  let avanzo = 100 - intere.reduce((s, x) => s + x, 0);
  const perResto = grezze
    .map((g, i) => ({ i, resto: g - Math.floor(g) }))
    .sort((a, b) => b.resto - a.resto || v[a.i] - v[b.i] || a.i - b.i);
  for (const { i } of perResto) {
    if (avanzo <= 0) break;
    intere[i] += 1;
    avanzo -= 1;
  }
  return intere;
}

/**
 * Da `dati.eventi` (la risposta di statistiche_riepilogo) al riquadro "Torte
 * già composte". Non lancia mai: una risposta strana dà un riquadro vuoto,
 * non una scheda rotta.
 *
 * Restituisce:
 *   aCatalogo  false = le voci per torta non sono ancora nel database
 *              (migrazione 2026-10-09 non eseguita): si sa solo il totale
 *   torte      [{ chiave, nome, gruppo, ordine, valore }], dalla più scelta
 *   perGruppo  [{ id, nome, icona, singolare, valore, quota, torte }]
 *              quota = percentuale sulle scelte divise (le due fanno 100)
 *   dettaglio  scelte con la torta (la somma dei gruppi)
 *   generico   scelte col vecchio evento, senza la torta
 *   totale     dettaglio + generico: quante volte, in tutto
 *   max, top   il numero più alto e le torte che lo hanno (pari merito
 *              comprese); top è vuoto se nessuno ha scelto niente
 */
export function riepilogoConsigliate(eventi) {
  const lista = Array.isArray(eventi) ? eventi : [];
  const torte = [];
  const viste = new Set();
  let generico = 0;
  let genericoVisto = false;

  for (const e of lista) {
    if (!e || typeof e !== 'object') continue;
    const chiave = typeof e.chiave === 'string' ? e.chiave : '';
    if (chiave === GENERICO) {
      if (!genericoVisto) generico = quanti(e.conteggio);
      genericoVisto = true;
      continue;
    }
    if (!chiave.startsWith(PREFISSO) || viste.has(chiave)) continue;
    const resto = chiave.slice(PREFISSO.length);
    // Il gruppo si riconosce, non si indovina: una chiave con un gruppo che
    // qui non esiste resta fuori, invece di finire nel mucchio sbagliato.
    const g = GRUPPI.find((x) => resto.startsWith(`${x.id}_`) && resto.length > x.id.length + 1);
    if (!g) continue;
    viste.add(chiave);
    torte.push({
      chiave,
      nome: String(e.etichetta || '').trim() || resto.slice(g.id.length + 1),
      gruppo: g.id,
      ordine: quanti(e.ordine),
      valore: quanti(e.conteggio),
    });
  }

  // Dalla più scelta; a pari numero, nell'ordine del catalogo (che è quello
  // della vetrina), così l'elenco non cambia ordine a ogni ricarica.
  torte.sort((a, b) => b.valore - a.valore || a.ordine - b.ordine || (a.chiave < b.chiave ? -1 : 1));

  const somme = GRUPPI.map((g) => torte.filter((t) => t.gruppo === g.id).reduce((s, t) => s + t.valore, 0));
  const quote = percentuali(somme);
  const perGruppo = GRUPPI.map((g, i) => ({
    ...g,
    valore: somme[i],
    quota: quote[i],
    torte: torte.filter((t) => t.gruppo === g.id),
  }));
  const dettaglio = somme.reduce((s, x) => s + x, 0);
  const max = torte.reduce((m, t) => Math.max(m, t.valore), 0);

  return {
    aCatalogo: torte.length > 0,
    torte,
    perGruppo,
    dettaglio,
    generico,
    totale: dettaglio + generico,
    max,
    top: max > 0 ? torte.filter((t) => t.valore === max) : [],
  };
}

/**
 * Cosa scrivere nella tessera "La più scelta": `valore` al posto del numero
 * grosso, `spiega` sotto.
 */
export function piuScelta(c) {
  const top = Array.isArray(c?.top) ? c.top : [];
  if (!top.length) return { valore: '—', spiega: 'nessuna scelta in questo periodo' };
  if (top.length === 1) {
    const g = GRUPPI.find((x) => x.id === top[0].gruppo);
    return { valore: top[0].nome, spiega: `${volte(c.max)} · ${g ? g.singolare : ''}`.replace(/ · $/, '') };
  }
  if (top.length <= MAX_NOMI) {
    return { valore: elencoNomi(top.map((t) => t.nome)), spiega: `pari merito, ${volte(c.max)} ciascuna` };
  }
  return {
    valore: `${top.length} a pari merito`,
    spiega: `${volte(c.max)} ciascuna: sono evidenziate negli elenchi qui sotto`,
  };
}

/** "🍦 12 · 🍰 7" per la riga di "Le altre scelte"; vuoto se non c'è divisione. */
export function divisione(c) {
  if (!c || !c.dettaglio || !Array.isArray(c.perGruppo)) return '';
  return GRUPPI
    .map((g) => {
      const x = c.perGruppo.find((p) => p.id === g.id);
      return `${g.icona} ${fmt(x ? x.valore : 0)}`;
    })
    .join(' · ');
}
