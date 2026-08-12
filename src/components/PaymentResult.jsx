import { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { tracciaUnaVolta, EV } from '../lib/analytics';

// Overlay mostrato al ritorno da Stripe Checkout (?pagamento=ok | annullato).
export default function PaymentResult({ result, delivery = false, onClose }) {
  const ok = result === 'ok';

  // Esito del pagamento: non è un click, e l'effetto deve stare PRIMA
  // dell'uscita anticipata qui sotto (le hook si chiamano sempre, sempre nello
  // stesso ordine). Una volta sola per caricamento: il componente può rimontare.
  useEffect(() => {
    if (!result) return;
    tracciaUnaVolta(ok ? EV.TORTA_PAGAMENTO_OK : EV.TORTA_PAGAMENTO_ANNULLATO);
  }, [result, ok]);

  if (!result) return null;

  return (
    <div
      className="cfg-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
    >
      <div
        style={{
          background: 'var(--cream, #fff)',
          borderRadius: 20,
          maxWidth: 460,
          width: '100%',
          padding: '2.4rem 1.8rem',
          textAlign: 'center',
          boxShadow: '0 20px 60px -20px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ color: ok ? '#2e9e5b' : '#c0392b', display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>
          {ok ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
        </div>
        <h2 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-display, serif)', color: 'var(--ink, #2a1a3e)' }}>
          {ok ? 'Ordine confermato! 🎂' : 'Pagamento annullato'}
        </h2>
        <p style={{ color: 'var(--grey, #6b6b7b)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: 380, margin: '0 auto 1.4rem' }}>
          {ok
            ? `Grazie! Abbiamo ricevuto il tuo ordine e il pagamento. Ti arriva la conferma via email e prepariamo tutto per ${delivery ? 'la consegna' : 'il ritiro'}.`
            : 'Nessun importo è stato addebitato. Puoi riprovare quando vuoi.'}
        </p>
        <button
          className="cfg-btn cfg-btn-next"
          onClick={onClose}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          Torna al sito
        </button>
      </div>
    </div>
  );
}
