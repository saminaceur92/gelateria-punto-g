import { supabase } from './supabase';

/**
 * Foto della torta 3D: caricata su Supabase Storage (bucket `torte`) al momento
 * dell'ordine, così nella riga finisce solo il LINK.
 *
 * Perché: per gli ordini dal sito la riga viene creata dal webhook Stripe a
 * pagamento avvenuto, ricomponendola dai metadata della sessione — che stanno
 * in campi da 500 caratteri l'uno. L'immagine (20-30 KB in base64) non ci
 * entrava, quindi gli ordini pagati arrivavano in dashboard senza foto.
 *
 * Serve la migrazione migrations/2026-07-26-foto-torte.sql. Se il caricamento
 * non riesce torna null: l'ordine si salva comunque, solo senza foto.
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

/** Carica la foto e restituisce l'URL pubblico (o null se non ci riesce). */
export async function uploadCakePhoto(dataUrl) {
  if (!supabase || !dataUrl || !String(dataUrl).startsWith('data:image')) return null;
  try {
    const blob = dataUrlToBlob(dataUrl);
    if (!blob || !blob.size) return null;
    // Cartella per mese: lo storage resta ordinato e ripulibile.
    const d = new Date();
    const path = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}/${uuid()}.jpg`;
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
