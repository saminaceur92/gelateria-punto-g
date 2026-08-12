import { supabase } from './supabase';
import { logAction } from './log';
import galleryImages from '../data/galleryImages';

/**
 * Foto della gallery caricabili dalla dashboard.
 *
 * Le foto vivono su Supabase Storage (bucket `gallery`, pubblico in lettura) e
 * la tabella `gallery_foto` dice quali sono online e in che ordine. La migrazione
 * importa qui anche le 50 foto storiche di public/gallery/, così dalla dashboard
 * si possono ordinare ed eliminare esattamente come quelle appena caricate.
 *
 * Servono la migrazione 2026-08-10-batch-agosto.sql e, per importare le foto
 * storiche, 2026-08-11-gallery-ordine-e-panna-standard.sql.
 */

export const BUCKET = 'gallery';
export const MAX_MB = 8;
// Riga tecnica, inattiva e quindi invisibile in dashboard/sito. Distingue una
// gallery volutamente svuotata da una tabella ancora in attesa dell'import.
const GALLERY_READY_ID = '00000000-0000-0000-0000-000000000001';
// Lato lungo massimo: i titolari caricheranno foto dal telefono (3-8 MB l'una) e
// una gallery da 50 foto a piena risoluzione renderebbe il sito lentissimo.
const LATO_MAX = 1600;
const QUALITA = 0.82;

/** Fallback storico usato soltanto se la tabella non è ancora stata creata. */
export const fotoStatiche = () => (galleryImages || []).map((src) => ({ url: src, statica: true }));

/** La tabella non c'è ancora: va eseguita la migrazione. */
export const daConfigurare = (msg) => !!msg && /(does not exist|schema cache|bucket not found)/i.test(msg);

/** Elenco delle foto caricate dalla dashboard (più recenti/ordinate prima). */
export async function fetchGalleryFoto() {
  if (!supabase) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('gallery_foto')
      .select('*')
      .eq('attivo', true)
      .order('ordine', { ascending: true })
      .order('creato_il', { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (e) {
    return { data: [], error: e?.message || 'Errore di rete' };
  }
}

/**
 * Elenco completo mostrato al pubblico, già nell'ordine scelto in dashboard.
 */
export async function fetchGalleryCompleta() {
  if (!supabase) return fotoStatiche();
  const { data, error } = await fetchGalleryFoto();
  // Prima della migrazione (o se Supabase non risponde) si continua a mostrare
  // la gallery inclusa nel sito.
  if (error) return fotoStatiche();
  const caricate = (data || []).map((f) => ({ url: f.url, titolo: f.titolo || '', id: f.id }));
  if (caricate.length) return caricate;

  // Nessuna foto attiva: il marcatore dice se l'amministratore le ha eliminate
  // davvero tutte. Senza marcatore siamo ancora prima dell'import e usiamo il
  // fallback storico, evitando una gallery vuota durante il passaggio.
  const { data: pronta, error: errorePronta } = await supabase
    .from('gallery_foto')
    .select('id')
    .eq('id', GALLERY_READY_ID)
    .maybeSingle();
  return !errorePronta && pronta ? [] : fotoStatiche();
}

export function validaFoto(file) {
  if (!file) return 'Scegli una foto.';
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) return 'Formati accettati: JPG, PNG o WebP.';
  if (file.size > MAX_MB * 1024 * 1024) return `La foto è troppo grande (max ${MAX_MB} MB).`;
  if (!file.size) return 'Il file sembra vuoto.';
  return null;
}

// "2026-08-10-1432": ordina bene e si legge a colpo d'occhio nello storage.
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Rimpicciolisce la foto nel browser prima di caricarla: le foto da telefono
 * pesano 3-8 MB e riempirebbero lo storage rallentando il sito.
 * Se qualcosa va storto si carica il file originale, senza bloccare nulla.
 */
function ridimensiona(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scala = Math.min(1, LATO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      if (scala === 1 && file.size < 1.2 * 1024 * 1024) return resolve(file);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scala);
      c.height = Math.round(img.naturalHeight * scala);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', QUALITA);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Carica una foto "di servizio" nello storage (stessa qualità/riduzione della
 * gallery) e restituisce { url, path } senza toccare la tabella della gallery.
 * Serve alle foto di esempio delle coperture: la riga a cui appartengono sta
 * in un'altra tabella, qui si gestisce solo il file.
 */
export async function caricaFotoFile({ file, cartella = 'esempi' }) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const bad = validaFoto(file);
  if (bad) return { error: bad };
  const ridotta = await ridimensiona(file);
  const path = `${cartella}/${stamp()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, ridotta, {
    contentType: ridotta.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (up.error) {
    const msg = /bucket/i.test(up.error.message)
      ? `${up.error.message} — esegui la migrazione 2026-08-10-batch-agosto.sql su Supabase.`
      : up.error.message;
    return { error: msg };
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: pub?.publicUrl || null, path, error: null };
}

/** Cancella un file di storage caricato con caricaFotoFile (best effort). */
export async function eliminaFotoFile(path) {
  if (!supabase || !path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

/** Carica una foto e la pubblica sul sito. */
export async function caricaFoto({ file, titolo = '', email }) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const bad = validaFoto(file);
  if (bad) return { error: bad };

  const ridotta = await ridimensiona(file);
  const path = `${stamp()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, ridotta, {
    contentType: ridotta.type || 'image/jpeg',
    cacheControl: '31536000', // il nome è unico: la foto non cambia mai contenuto
    upsert: false,
  });
  if (up.error) {
    const msg = /bucket/i.test(up.error.message)
      ? `${up.error.message} — esegui la migrazione 2026-08-10-batch-agosto.sql su Supabase.`
      : up.error.message;
    return { error: msg };
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Le nuove foto finiscono in fondo all'ordine scelto in dashboard. I file si
  // caricano in sequenza, quindi anche una selezione multipla mantiene l'ordine
  // con cui il browser li consegna.
  const { data: ultima } = await supabase
    .from('gallery_foto')
    .select('ordine')
    .order('ordine', { ascending: false })
    .limit(1);
  const ordine = (Number(ultima?.[0]?.ordine) || 0) + 10;
  const { data, error } = await supabase
    .from('gallery_foto')
    .insert({ url: pub?.publicUrl || null, path, titolo, ordine, aggiunto_da: email || null })
    .select()
    .single();
  if (error) return { error: error.message };
  logAction('Gallery: foto aggiunta', file.name);
  return { data, error: null };
}

/** Salva l'ordine completo scelto nella dashboard con una sola richiesta. */
export async function salvaOrdineFoto(fotoOrdinate) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const righe = (fotoOrdinate || []).map((f, i) => ({
    id: f.id,
    url: f.url,
    path: f.path || null,
    titolo: f.titolo || '',
    ordine: (i + 1) * 10,
    attivo: f.attivo !== false,
    creato_il: f.creato_il,
    aggiunto_da: f.aggiunto_da || null,
  }));
  if (!righe.length) return { error: null };
  const { error } = await supabase.from('gallery_foto').upsert(righe, { onConflict: 'id' });
  if (error) return { error: error.message };
  logAction('Gallery: ordine modificato', `${righe.length} foto`);
  return { error: null };
}

/** Toglie la foto dal sito e cancella il file: è definitivo. */
export async function eliminaFoto(foto) {
  if (!supabase) return { error: 'Supabase non configurato' };
  const { error } = await supabase.from('gallery_foto').delete().eq('id', foto.id);
  if (error) return { error: error.message };
  // Il file va tolto anche dallo storage, altrimenti resta lì a occupare spazio
  // (e resterebbe raggiungibile da chi ne conosce l'indirizzo).
  if (foto.path) await supabase.storage.from(BUCKET).remove([foto.path]);
  logAction('Gallery: foto eliminata', foto.titolo || foto.path || '');
  return { error: null };
}
