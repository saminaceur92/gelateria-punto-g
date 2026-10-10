import { useEffect, useRef, useState } from 'react';
import { BellOff, CheckCircle2, XCircle } from 'lucide-react';
import { infoPromemoria, stopPromemoria, togliPromemoria } from '../lib/promemoria';
import { testiPromemoria } from '../lib/promemoriaRegole';

/**
 * Pagina dei due link in fondo alle mail dei promemoria (compleanno e anniversario):
 *   ?togli=<token>  «Non ricordarmi più questa ricorrenza» → solo quella festa,
 *                   per sempre (anche se il cliente riordina per la stessa festa)
 *   ?stop=<token>   «Non voglio più nessun promemoria»     → tutto l'indirizzo
 * Prima di cambiare qualcosa chiede SEMPRE un clic di conferma: alcuni filtri
 * antivirus (Safe Links e simili) aprono da soli i link delle mail, e prima
 * bastava quello per disiscrivere il cliente senza che lo volesse.
 * Il token 'prova' arriva dalle copie di prova mandate dal gestionale: la
 * pagina si vede uguale, ma non chiama il database.
 * Stessa veste di PaymentResult.
 */

// Nella prova non sappiamo di che festa si tratta: parole neutre.
const INFO_PROVA = { occasione: null, anniversario: null, nome: null, in_coda: 2, tolto: false, disiscritto: false };

function dataFesta(iso) {
  if (!iso) return '';
  try {
    return ` del ${new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}`;
  } catch {
    return '';
  }
}

const COLORE = { ok: '#2e9e5b', ko: '#c0392b', domanda: 'var(--violet-deep, #2c7699)' };

export default function PromemoriaStop({ link, onClose }) {
  const [modo, setModo] = useState(link.modo); // 'togli' | 'stop' (si può passare dall'uno all'altro)
  const [fase, setFase] = useState('carico');
  const [info, setInfo] = useState(null);
  const [lavoro, setLavoro] = useState(false);
  const primario = useRef(null);

  useEffect(() => {
    let vivo = true;
    if (link.prova) {
      setInfo(INFO_PROVA);
      setFase('domanda');
      return undefined;
    }
    if (!link.token) {
      setFase('non_valido');
      return undefined;
    }
    infoPromemoria(link.token).then((r) => {
      if (!vivo) return;
      if (r.stato === 'ok') {
        setInfo(r.info);
        if (r.info.disiscritto) setFase('disiscritto');
        else if (link.modo === 'stop') setFase('domanda');
        // Già tolta per sempre: lo si dice. Altrimenti si chiede, anche se le
        // mail di quest'anno sono già arrivate tutte: «togli» vale anche per
        // gli anni prossimi.
        else setFase(r.info.tolto ? 'gia_tolto' : 'domanda');
      } else if (r.stato === 'non_valido') {
        setFase('non_valido');
      } else if (link.modo === 'stop') {
        // Per disiscriversi basta il token: si chiede conferma anche se il
        // riepilogo non è arrivato (migrazione non ancora lanciata, rete lenta).
        setFase('domanda');
      } else {
        setFase(r.stato === 'non_attivo' ? 'non_valido' : 'errore');
      }
    });
    return () => { vivo = false; };
  }, [link]);

  // Esc chiude, come le altre finestre del sito.
  useEffect(() => {
    const tasto = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tasto);
    return () => window.removeEventListener('keydown', tasto);
  }, [onClose]);

  // A ogni passo il fuoco va sul bottone principale (tastiera e lettori di schermo).
  useEffect(() => {
    if (fase !== 'carico') primario.current?.focus();
  }, [fase, modo]);

  async function conferma() {
    if (lavoro) return;
    setLavoro(true);
    if (link.prova) {
      setFase('fatto');
    } else if (modo === 'togli') {
      const r = await togliPromemoria(link.token);
      setFase(r.ok ? 'fatto' : 'errore');
    } else {
      const ok = await stopPromemoria(link.token);
      setFase(ok ? 'fatto' : 'non_valido');
    }
    setLavoro(false);
  }

  const passaA = (nuovo) => { setModo(nuovo); setFase('domanda'); };

  const t = info?.occasione ? testiPromemoria(info.occasione) : null;
  const festa = t ? `${t.ricorrenza}${dataFesta(info.anniversario)}` : 'questa ricorrenza';
  const ciao = info?.nome ? `Ciao ${info.nome}, ` : '';
  const cambiIdea = 'Se cambi idea, dillo allo staff al prossimo ordine.';
  const linkStop = { testo: 'Non voglio più nessun promemoria', fai: () => passaA('stop') };

  // Cosa mostrare a ogni passo: icona, titolo, testo, bottoni.
  let v;
  if (fase === 'carico') {
    v = { titolo: 'Un attimo…' };
  } else if (fase === 'non_valido') {
    v = {
      icona: 'ko', titolo: 'Link non valido',
      testo: 'Questo link non risulta più attivo. Se continui a ricevere i promemoria scrivici e li togliamo subito.',
    };
  } else if (fase === 'errore') {
    v = {
      icona: 'ko', titolo: 'Qualcosa non va',
      testo: 'Non riusciamo a collegarci in questo momento. Riprova fra qualche minuto: non è cambiato niente.',
    };
  } else if (fase === 'disiscritto') {
    v = {
      icona: 'ok', titolo: 'Sei già a posto',
      testo: `Questo indirizzo non riceve più nessun promemoria. ${cambiIdea}`,
    };
  } else if (modo === 'togli' && fase === 'domanda') {
    v = {
      icona: 'domanda', titolo: 'Togliamo questo promemoria?',
      testo: `${ciao}non ti ricorderemo più ${festa}. Gli altri promemoria, se ne hai, restano attivi.`,
      si: 'Sì, togli solo questo', no: 'No, lascialo', link: linkStop,
    };
  } else if (modo === 'togli' && fase === 'fatto') {
    v = {
      icona: 'ok', titolo: 'Fatto',
      testo: `Non ti ricorderemo più ${festa}, nemmeno negli anni prossimi. Gli altri promemoria restano attivi.`,
      link: linkStop,
    };
  } else if (fase === 'gia_tolto') {
    v = {
      icona: 'ok', titolo: 'Già fatto',
      testo: `Questo promemoria era già stato tolto: per ${festa} non ti scriveremo più.`,
      link: linkStop,
    };
  } else if (modo === 'stop' && fase === 'domanda') {
    v = {
      icona: 'domanda', titolo: 'Non vuoi più nessun promemoria?',
      testo: `${ciao}non ti scriveremo più per compleanni e anniversari. Le conferme dei tuoi ordini continueranno ad arrivare.`,
      si: 'Sì, non scrivetemi più', no: 'No, annulla',
      // Prima di togliere tutto, la scelta più leggera (se questa festa non è già tolta).
      link: info && !info.tolto
        ? { testo: t ? `Togli solo ${festa}` : 'Togli solo questa ricorrenza', fai: () => passaA('togli') }
        : null,
    };
  } else {
    v = {
      icona: 'ok', titolo: 'Fatto',
      testo: `Non ti manderemo più nessun promemoria. ${cambiIdea}`,
    };
  }

  const Icona = v.icona === 'ok' ? CheckCircle2 : v.icona === 'ko' ? XCircle : BellOff;
  const domanda = Boolean(v.si);

  return (
    <div
      className="cfg-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prom-titolo"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ display: 'flex', padding: '1rem', overflowY: 'auto' }}
    >
      <div
        style={{
          margin: 'auto',
          background: 'var(--cream, #fbf6ec)',
          borderRadius: 20,
          maxWidth: 460,
          width: '100%',
          padding: 'clamp(1.6rem, 6vw, 2.4rem) clamp(1.1rem, 5vw, 1.8rem)',
          textAlign: 'center',
          boxShadow: '0 20px 60px -20px rgba(0,0,0,0.4)',
        }}
      >
        {link.prova && (
          <p
            style={{
              margin: '0 0 1.2rem', padding: '0.55rem 0.8rem', borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.45,
              background: 'rgba(192,137,76,0.12)', color: '#7a4f1e', border: '1px dashed rgba(192,137,76,0.55)',
            }}
          >
            Pagina di prova: è quella che vede il cliente, ma da qui non si toglie niente.
          </p>
        )}

        {v.icona && (
          <div style={{ color: COLORE[v.icona], display: 'flex', justifyContent: 'center', marginBottom: '0.8rem' }}>
            <Icona size={52} aria-hidden="true" />
          </div>
        )}
        <h2 id="prom-titolo" style={{ margin: '0 0 0.5rem', fontFamily: 'var(--font-display, sans-serif)', color: 'var(--ink, #32281f)', lineHeight: 1.2 }}>
          {v.titolo}
        </h2>
        {v.testo && (
          <p aria-live="polite" style={{ color: 'var(--grey, #7a7166)', fontSize: '0.95rem', lineHeight: 1.55, maxWidth: 380, margin: '0 auto 1.4rem' }}>
            {v.testo}
          </p>
        )}

        {fase !== 'carico' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
            {domanda ? (
              <>
                <button
                  ref={primario}
                  type="button"
                  className="cfg-btn cfg-btn-next"
                  onClick={conferma}
                  disabled={lavoro}
                  style={{ flex: '1 1 190px', justifyContent: 'center', minHeight: 46 }}
                >
                  {lavoro ? 'Un attimo…' : v.si}
                </button>
                <button
                  type="button"
                  className="cfg-btn cfg-btn-back"
                  onClick={onClose}
                  disabled={lavoro}
                  style={{ flex: '1 1 150px', justifyContent: 'center', minHeight: 46 }}
                >
                  {v.no}
                </button>
              </>
            ) : (
              <button
                ref={primario}
                type="button"
                className="cfg-btn cfg-btn-next"
                onClick={onClose}
                style={{ justifyContent: 'center', minHeight: 46, minWidth: 180 }}
              >
                Vai al sito
              </button>
            )}
          </div>
        )}

        {v.link && !lavoro && (
          <button
            type="button"
            onClick={v.link.fai}
            style={{
              display: 'inline-block', marginTop: '1.1rem', padding: '0.6rem 0.4rem', minHeight: 44,
              background: 'none', border: 0, cursor: 'pointer', fontSize: '0.85rem',
              color: 'var(--grey, #7a7166)', textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            {v.link.testo}
          </button>
        )}
      </div>
    </div>
  );
}
