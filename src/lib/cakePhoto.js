import { supabase } from './supabase';

/**
 * Immagini dell'ordine caricate su Supabase Storage (bucket `torte`), così
 * nella riga finiscono solo LINK brevi:
 *   - foto cliente per la cialda, da scaricare e mandare su Telegram;
 *   - anteprima leggera della torta 3D, solo per la lista ordini.
 *
 * Perché: per gli ordini dal sito la riga viene creata dal webhook Stripe a
 * pagamento avvenuto, ricomponendola dai metadata della sessione — che stanno
 * in campi da 500 caratteri l'uno. L'immagine (20-30 KB in base64) non ci
 * entrava, quindi gli ordini pagati arrivavano in dashboard senza foto.
 *
 * Dal 29-08 le immagini sono DUE per ordine, con lo stesso id:
 *   <id>-cialda.jpg     → foto caricata dal cliente;
 *   <id>-anteprima.jpg  → miniatura del modello 3D per la dashboard.
 *
 * Serve la migrazione migrations/2026-07-26-foto-torte.sql. Se un caricamento
 * non riesce torna null per quella foto: l'ordine si salva comunque.
 */

export const BUCKET_TORTE = 'torte';

// "data:image/jpeg;base64,…" → Blob, senza passare da fetch()
function dataUrlToBlob(dataUrl) {
  const [head, b64] = String(dataUrl).split(',');
  if (!b64) return null;
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const uuid = () => (window.crypto?.randomUUID
  ? window.crypto.randomUUID()
  : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

/** Carica UNA foto al percorso dato e restituisce l'URL pubblico (o null). */
async function carica(dataUrl, path) {
  if (!supabase || !dataUrl || !String(dataUrl).startsWith('data:image')) return null;
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob || !blob.size) return null;
    const { error } = await supabase.storage.from(BUCKET_TORTE).upload(path, blob, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) {
      console.warn('[foto torta] non caricata:', error.message);
      return null;
    }
    return supabase.storage.from(BUCKET_TORTE).getPublicUrl(path).data?.publicUrl || null;
  } catch (e) {
    console.warn('[foto torta] errore:', e && e.message);
    return null;
  }
}

/**
 * Carica la foto cliente e l'anteprima 3D, insieme.
 * Restituisce `{ customer, preview }` con gli URL pubblici (null quella che non è
 * riuscita). Le due partono in parallelo: non c'è motivo di aspettare.
 */
export async function uploadCakePhotos({ customer, preview }) {
  if (!supabase) return { customer: null, preview: null };
  // Cartella per mese: lo storage resta ordinato e ripulibile.
  const d = new Date();
  const cartella = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const id = uuid();
  const [urlCustomer, urlPreview] = await Promise.all([
    carica(customer, `${cartella}/${id}-cialda.jpg`),
    carica(preview, `${cartella}/${id}-anteprima.jpg`),
  ]);
  return { customer: urlCustomer, preview: urlPreview };
}

/**
 * Link che fa SCARICARE la foto invece di aprirla: Supabase Storage, con
 * `?download=<nome>`, risponde con "Content-Disposition: attachment". Vale per
 * la dashboard e per il messaggio Telegram (lì lo compone il database allo
 * stesso modo, vedi migrations/2026-08-29-foto-telegram-e-locale.sql).
 */
export function linkDownloadFoto(url, nomeCliente) {
  if (!url) return '';
  const slug = String(nomeCliente || 'cliente')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'cliente';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}download=${encodeURIComponent(`foto-cialda-${slug}.jpg`)}`;
}
