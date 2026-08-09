import { supabase } from './supabase';
import { logAction } from './log';

/**
 * Documenti pubblici caricabili dalla dashboard (per ora: il Quaderno
 * Ingredienti e Allergeni).
 *
 * Il PDF vive su Supabase Storage (bucket `documenti`, pubblico) e la riga
 * `documenti` in database dice qual è la versione corrente: così lo staff può
 * pubblicare un PDF aggiornato dal gestionale, senza deploy e senza toccare il
 * codice. Il link della pagina /allergeni e del QR restano gli stessi.
 *
 * Serve la migrazione migrations/2026-07-26-documenti-e-qr.sql.
 * Finché non è stata eseguita tutto ricade sul PDF statico nel repo.
 */

export const DOC_ALLERGENI = 'allergeni';
export const BUCKET = 'documenti';

/** PDF versionato nel repo: rete di sicurezza se lo storage non è configurato. */
export const PDF_FALLBACK = '/documenti/quaderno-allergeni-punto-gi.pdf';

/** Dove porta il QR Code se in database non è stato impostato nulla. */
export const QR_URL_DEFAULT = 'https://www.gelateriapuntogi.it/allergeni';

export const MAX_MB = 25;

/** Legge la riga del documento. Torna { data, error } senza mai lanciare. */
export async function getDocumento(chiave = DOC_ALLERGENI) {
  if (!supabase) return { data: null, error: 'Supabase non configurato' };
  try {
    const { data, error } = await supabase
      .from('documenti')
      .select('*')
      .eq('chiave', chiave)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    return { data: data || null, error: null };
  } catch (e) {
    return { data: null, error: e?.message || 'Errore di rete' };
  }
}

/** URL del PDF da mostrare al pubblico (caricato dalla dashboard o statico). */
export const pdfUrl = (doc) => doc?.file_url || PDF_FALLBACK;

/** Destinazione del QR Code (modificabile dalla dashboard). */
export const qrUrl = (doc) => doc?.qr_url || QR_URL_DEFAULT;

// "2026-07-26-1432" — ordina bene e si legge a colpo d'occhio nello storage.
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Nome file sicuro per lo storage (niente accenti, spazi o caratteri strani).
function slugFile(name = 'documento.pdf') {
  const base = name.replace(/\.pdf$/i, '');
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${clean || 'documento'}.pdf`;
}

export function validaPdf(file) {
  if (!file) return 'Scegli un file PDF.';
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) return 'Il file deve essere un PDF.';
  if (file.size > MAX_MB * 1024 * 1024) return `Il PDF è troppo grande (max ${MAX_MB} MB).`;
  if (!file.size) return 'Il file sembra vuoto.';
  return null;
}

// Colonne aggiunte da migrations/2026-08-05-quaderno-generato.sql. Finché la
// migrazione non è stata eseguita il database non le conosce: in quel caso si
// salva senza, invece di far fallire la pubblicazione del PDF.
const COLONNE_NUOVE = ['generato', 'dati_hash'];
const colonnaMancante = (msg) => /schema cache|does not exist|column .* of relation/i.test(msg || '');

const senzaColonneNuove = (patch) => {
  const p = { ...patch };
  COLONNE_NUOVE.forEach((k) => delete p[k]);
  return p;
};

/**
 * Carica un nuovo PDF e lo rende quello ufficiale.
 * Ogni caricamento crea un file nuovo (versionato): niente problemi di cache e
 * le versioni precedenti restano consultabili.
 *
 * `generato`/`hash` valorizzati = PDF creato dal gestionale dai dati in
 * database (vedi src/lib/quadernoPdf.js): servono a sapere se è ancora
 * allineato a quello che c'è nella scheda "Gusti e allergeni".
 */
export async function caricaDocumento({ chiave = DOC_ALLERGENI, file, titolo, email, generato = false, hash = null }) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const bad = validaPdf(file);
  if (bad) return { error: bad };

  const path = `${chiave}/${stamp()}-${slugFile(file.name)}`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    cacheControl: '3600',
    upsert: false,
  });
  if (up.error) {
    const msg = /bucket/i.test(up.error.message)
      ? `${up.error.message} — esegui la migrazione 2026-07-26-documenti-e-qr.sql su Supabase.`
      : up.error.message;
    return { error: msg };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const patch = {
    file_url: pub?.publicUrl || null,
    file_nome: file.name,
    file_path: path,
    aggiornato_il: new Date().toISOString(),
    aggiornato_da: email || null,
    generato: !!generato,
    dati_hash: hash || null,
  };

  // Prima update (la riga esiste già dalla migrazione), altrimenti insert:
  // così non si sovrascrive mai `qr_url` con un valore vuoto.
  let upd;
  let e1;
  ({ data: upd, error: e1 } = await supabase.from('documenti').update(patch).eq('chiave', chiave).select());
  if (e1 && colonnaMancante(e1.message)) {
    ({ data: upd, error: e1 } = await supabase
      .from('documenti')
      .update(senzaColonneNuove(patch))
      .eq('chiave', chiave)
      .select());
  }
  if (e1) return { error: e1.message };

  const etichetta = generato ? 'PDF allergeni generato dai dati' : 'PDF allergeni aggiornato';

  if (!upd || upd.length === 0) {
    const nuovo = { chiave, titolo: titolo || '', qr_url: QR_URL_DEFAULT, ...patch };
    let ins;
    let e2;
    ({ data: ins, error: e2 } = await supabase.from('documenti').insert(nuovo).select().single());
    if (e2 && colonnaMancante(e2.message)) {
      ({ data: ins, error: e2 } = await supabase
        .from('documenti')
        .insert(senzaColonneNuove(nuovo))
        .select()
        .single());
    }
    if (e2) return { error: e2.message };
    logAction(etichetta, file.name);
    return { data: ins, error: null };
  }

  logAction(etichetta, file.name);
  return { data: upd[0], error: null };
}

/** Cambia l'indirizzo a cui punta il QR (es. quando arriva il dominio). */
export async function salvaQrUrl(chiave, url) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { data, error } = await supabase
    .from('documenti')
    .update({ qr_url: url })
    .eq('chiave', chiave)
    .select();
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    const { error: e2 } = await supabase.from('documenti').insert({ chiave, qr_url: url });
    if (e2) return { error: e2.message };
  }
  logAction('QR allergeni: indirizzo aggiornato', url);
  return { error: null };
}

/** Versioni precedenti del PDF presenti nello storage (più recenti prima). */
export async function listaVersioni(chiave = DOC_ALLERGENI) {
  if (!supabase) return { data: [], error: null };
  const { data, error } = await supabase.storage.from(BUCKET).list(chiave, {
    limit: 100,
    sortBy: { column: 'name', order: 'desc' },
  });
  if (error) return { data: [], error: error.message };
  const files = (data || []).filter((f) => /\.pdf$/i.test(f.name));
  return {
    data: files.map((f) => {
      const path = `${chiave}/${f.name}`;
      return {
        path,
        nome: f.name,
        dimensione: f.metadata?.size || 0,
        creato: f.created_at || null,
        url: supabase.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl || null,
      };
    }),
    error: null,
  };
}

/** Elimina una vecchia versione (mai quella pubblicata: bloccato lato UI). */
export async function eliminaVersione(path) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) return { error: error.message };
  logAction('PDF allergeni: versione eliminata', path);
  return { error: null };
}
