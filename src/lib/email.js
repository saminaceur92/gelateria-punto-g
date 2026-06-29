// Invio email di conferma ordine al cliente, tramite EmailJS (dal browser).
// Le chiavi sono "pubblicabili" (la Public Key è pensata per stare nel client).
const EMAILJS = {
  serviceId: 'service_84b0jde',
  templateId: 'template_wornujj',
  publicKey: 'BTO4welmqMDIfQLbp',
};

// params: { email, cliente, ordine, ritiro, importo }
// Best-effort: l'ordine è già salvato, quindi un eventuale errore non blocca nulla.
export async function sendOrderEmail(params) {
  if (!params || !params.email) return false;
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS.serviceId,
        template_id: EMAILJS.templateId,
        user_id: EMAILJS.publicKey,
        template_params: params,
      }),
    });
    if (!res.ok) {
      console.warn('[email] non inviata:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[email] errore:', e && e.message);
    return false;
  }
}
