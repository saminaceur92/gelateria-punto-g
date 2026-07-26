import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { stopPromemoria } from '../lib/promemoria';

/**
 * Conferma della disiscrizione dai promemoria compleanno (link "non voglio più
 * ricevere questi promemoria" in fondo alle mail). Stessa veste di PaymentResult.
 */
export default function PromemoriaStop({ token, onClose }) {
  const [esito, setEsito] = useState(null); // null = in corso

  useEffect(() => {
    let alive = true;
    stopPromemoria(token).then((ok) => alive && setEsito(ok));
    return () => { alive = false; };
  }, [token]);

  const ok = esito === true;

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
        {esito === null ? (
          <p style={{ color: 'var(--grey, #6b6b7b)', margin: '0 0 1.4rem' }}>Un attimo…</p>
        ) : (
          <>
            <div style={{ color: ok ? '#2e9e5b' : '#c0392b', display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>
              {ok ? <CheckCircle2 size={56} /> : <XCircle size={56} />}
            </div>
            <h2 style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-display, serif)', color: 'var(--ink, #2a1a3e)' }}>
              {ok ? 'Fatto' : 'Link non valido'}
            </h2>
            <p style={{ color: 'var(--grey, #6b6b7b)', fontSize: '0.95rem', lineHeight: 1.5, maxWidth: 380, margin: '0 auto 1.4rem' }}>
              {ok
                ? 'Non ti manderemo più il promemoria del compleanno. Se cambi idea, dillo allo staff al prossimo ordine.'
                : 'Questo link non risulta più attivo. Se continui a ricevere i promemoria scrivici e li togliamo subito.'}
            </p>
          </>
        )}
        <button
          className="cfg-btn cfg-btn-next"
          onClick={onClose}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          Vai al sito
        </button>
      </div>
    </div>
  );
}
