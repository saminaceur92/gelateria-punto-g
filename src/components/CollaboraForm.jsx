import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, CircleCheck, MessageCircle } from 'lucide-react';
import {
  TIPI, LIMITI, MSG_MAX, errori, primoErrore, parametri, pulito, dopoRisposta,
  tipoDaRicerca, linkWhatsapp, WHATSAPP_URL,
} from '../lib/collaboraRegole';
import { inviaCollaborazione } from '../lib/collabora';
import { traccia, EV } from '../lib/analytics';

/**
 * Il modulo «Collabora con noi»: la proposta arriva ai titolari (tabella
 * `collaborazioni` + avviso Telegram, vedi migrations/2026-10-09-collabora-con-noi.sql).
 *
 * Tre promesse a chi lo compila, e il codice è costruito per mantenerle:
 *   1. quello che ha scritto non si perde MAI: con un errore resta tutto lì,
 *      e se il server non risponde c'è WhatsApp con la proposta già scritta;
 *   2. un errore si vede sotto il campo giusto e il cursore ci va da solo;
 *   3. un solo invio per tocco: il pulsante resta occupato finché non c'è
 *      la risposta (e il database riconosce comunque il doppione).
 *
 * Anti-spam: il campo trappola (nascosto agli umani, i programmi lo
 * riempiono) e il tempo di compilazione li giudica il database; qui si
 * raccolgono e basta. Nessun indirizzo IP, nessun servizio esterno.
 */

const VUOTO = { tipo: '', nome: '', azienda: '', email: '', telefono: '', messaggio: '', privacy: false, sito: '' };

// Indirizzo dell'informativa: lo stesso del piè di pagina (iubenda).
const PRIVACY_URL = 'https://www.iubenda.com/privacy-policy/38165264';

/** Etichetta, campo, aiuto ed errore collegati fra loro per chi usa un lettore di schermo. */
function Campo({ id, etichetta, obbligatorio, facoltativo, aiuto, errore, piede, children }) {
  const idErrore = `${id}-errore`;
  const idAiuto = `${id}-aiuto`;
  // Con un errore l'aiuto lascia il posto al messaggio rosso: due righe
  // sotto lo stesso campo, su telefono, non le legge nessuno.
  const descritto = errore ? idErrore : aiuto ? idAiuto : undefined;
  return (
    <div className={`clb-campo${errore ? ' ha-errore' : ''}`}>
      <label htmlFor={id}>
        {etichetta}
        {obbligatorio && <span className="clb-ast" aria-hidden="true"> *</span>}
        {facoltativo && <span className="clb-facolt"> (facoltativo)</span>}
      </label>
      {children({ id, 'aria-invalid': errore ? 'true' : undefined, 'aria-describedby': descritto })}
      {(errore || aiuto || piede) && (
        <div className="clb-piede">
          {errore ? (
            <p id={idErrore} className="clb-errore">{errore}</p>
          ) : aiuto ? (
            <p id={idAiuto} className="clb-aiuto">{aiuto}</p>
          ) : null}
          {piede}
        </div>
      )}
    </div>
  );
}

/** Al posto del modulo, dopo l'invio riuscito. `titolo` riceve il cursore. */
export function Grazie({ v, giaRicevuta, titolo }) {
  const nome = pulito(v.nome).split(' ')[0];
  const telefono = pulito(v.telefono);
  return (
    <div className="clb-grazie">
      <span className="clb-grazie-ico" aria-hidden="true"><CircleCheck size={34} /></span>
      <h2 ref={titolo} tabIndex={-1}>Grazie{nome ? `, ${nome}` : ''}!</h2>
      {giaRicevuta ? (
        <p>L’avevamo già ricevuta: non serve rimandarla. Ti rispondiamo appena possibile.</p>
      ) : (
        <p>La tua proposta è arrivata: la leggiamo con calma e ti rispondiamo noi.</p>
      )}
      <p className="clb-grazie-dove">
        Ti scriviamo a <strong>{String(v.email).trim()}</strong>
        {telefono ? <> oppure ti chiamiamo al <strong>{telefono}</strong></> : null}.
      </p>
      <a className="btn btn-ghost" href="/">Torna al sito</a>
    </div>
  );
}

export default function CollaboraForm() {
  const [v, setV] = useState(() => ({
    ...VUOTO,
    tipo: tipoDaRicerca(typeof window !== 'undefined' ? window.location.search : ''),
  }));
  // Gli errori compaiono solo dopo il primo "Invia": chi ha appena iniziato
  // a scrivere non deve trovarsi il modulo pieno di rosso.
  const [provato, setProvato] = useState(false);
  const [erroriServer, setErroriServer] = useState({}); // { campo: motivo } dal database
  const [avviso, setAvviso] = useState(''); // errore che non riguarda un campo
  const [fase, setFase] = useState('modulo'); // 'modulo' | 'invio' | 'fatto'
  const [giaRicevuta, setGiaRicevuta] = useState(false);

  const aperto = useRef(0); // quando si è aperto il modulo (per il tempo minimo)
  const inVolo = useRef(false);
  const campi = useRef({});
  const grazie = useRef(null);
  // Il campo da raggiungere col cursore DOPO che l'errore è comparso: così il
  // lettore di schermo legge etichetta ed errore insieme, non il campo di prima.
  const daRaggiungere = useRef(null);

  useEffect(() => {
    aperto.current = performance.now();
  }, []);

  useEffect(() => {
    if (!daRaggiungere.current) return;
    const campo = daRaggiungere.current;
    daRaggiungere.current = null;
    vaiAlCampo(campo);
  });

  // Dopo l'invio riuscito il cursore va sul "Grazie": chi usa un lettore di
  // schermo sente subito l'esito, chi è in fondo al modulo lo vede.
  useEffect(() => {
    if (fase !== 'fatto' || !grazie.current) return;
    grazie.current.focus({ preventScroll: true });
    grazie.current.scrollIntoView({ block: 'center' });
  }, [fase]);

  const erroriLocali = useMemo(() => (provato ? errori(v) : {}), [v, provato]);
  const err = { ...erroriLocali, ...erroriServer };

  function aggiorna(campo, valore) {
    setV((x) => ({ ...x, [campo]: valore }));
    // L'errore del server su quel campo valeva per il testo di prima.
    setErroriServer((e) => {
      if (!e[campo]) return e;
      const { [campo]: _tolto, ...resto } = e;
      return resto;
    });
  }

  function vaiAlCampo(campo) {
    const el = campi.current[campo];
    if (!el) return;
    // Il tipo è un gruppo di pillole: si va su quella scelta, o sulla prima.
    const bersaglio = el.matches?.('fieldset')
      ? el.querySelector('input:checked') || el.querySelector('input')
      : el;
    bersaglio?.focus();
  }

  async function invia(e) {
    e.preventDefault();
    if (inVolo.current) return;
    setProvato(true);
    setAvviso('');
    setErroriServer({}); // oggetto nuovo: la pagina si ridisegna sempre, e l'effetto qui sopra parte

    const primo = primoErrore(errori(v));
    if (primo) {
      daRaggiungere.current = primo;
      return;
    }

    inVolo.current = true;
    setFase('invio');
    const d = dopoRisposta(await inviaCollaborazione(parametri(v, performance.now() - aperto.current)));
    inVolo.current = false;

    setGiaRicevuta(d.giaRicevuta);
    setErroriServer(d.erroriServer);
    // Senza campo il cursore resta sul pulsante (che non si è mai spento,
    // vedi sotto): il riquadro si annuncia da solo e WhatsApp è subito prima.
    setAvviso(d.avviso);
    daRaggiungere.current = d.campo;
    setFase(d.fase);
    // Chiamata esplicita e non data-ev sul pulsante: conta le proposte
    // ARRIVATE, non i tocchi su "Invia". Il doppione non si conta.
    if (d.conta) traccia(EV.COLLABORA_INVIATA);
  }

  if (fase === 'fatto') return <Grazie v={v} giaRicevuta={giaRicevuta} titolo={grazie} />;

  const invio = fase === 'invio';
  const quantiErrori = Object.keys(erroriLocali).length;

  return (
    <form className="clb-form" noValidate onSubmit={invia} aria-labelledby="clb-titolo">
      <div className="clb-testa">
        <h2 id="clb-titolo">Raccontaci la tua idea</h2>
        <p>I campi con <span className="clb-ast">*</span> sono obbligatori.</p>
      </div>

      <fieldset
        className={`clb-tipi${err.tipo ? ' ha-errore' : ''}`}
        ref={(el) => { campi.current.tipo = el; }}
        aria-describedby={err.tipo ? 'clb-tipo-errore' : undefined}
      >
        <legend>
          Di cosa si tratta?<span className="clb-ast" aria-hidden="true"> *</span>
        </legend>
        <div className="clb-pillole">
          {TIPI.map((t) => (
            <label key={t.id} className="clb-pillola">
              <input
                type="radio"
                name="tipo"
                value={t.id}
                checked={v.tipo === t.id}
                onChange={() => aggiorna('tipo', t.id)}
                required
                aria-invalid={err.tipo ? 'true' : undefined}
              />
              <span>{t.etichetta}</span>
            </label>
          ))}
        </div>
        {err.tipo && <p id="clb-tipo-errore" className="clb-errore">{err.tipo}</p>}
      </fieldset>

      <div className="clb-coppia">
        <Campo id="clb-nome" etichetta="Nome e cognome" obbligatorio errore={err.nome}>
          {(a) => (
            <input
              {...a}
              ref={(el) => { campi.current.nome = el; }}
              type="text"
              name="name"
              autoComplete="name"
              maxLength={LIMITI.nome}
              required
              value={v.nome}
              onChange={(e) => aggiorna('nome', e.target.value)}
            />
          )}
        </Campo>
        <Campo id="clb-azienda" etichetta="Azienda o locale" facoltativo errore={err.azienda}>
          {(a) => (
            <input
              {...a}
              ref={(el) => { campi.current.azienda = el; }}
              type="text"
              name="organization"
              autoComplete="organization"
              maxLength={LIMITI.azienda}
              value={v.azienda}
              onChange={(e) => aggiorna('azienda', e.target.value)}
            />
          )}
        </Campo>
      </div>

      <div className="clb-coppia">
        <Campo id="clb-email" etichetta="Email" obbligatorio aiuto="Ti rispondiamo qui." errore={err.email}>
          {(a) => (
            <input
              {...a}
              ref={(el) => { campi.current.email = el; }}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={LIMITI.email}
              required
              value={v.email}
              onChange={(e) => aggiorna('email', e.target.value)}
            />
          )}
        </Campo>
        <Campo
          id="clb-telefono"
          etichetta="Telefono"
          facoltativo
          aiuto="Se preferisci che ti chiamiamo o ti scriviamo su WhatsApp."
          errore={err.telefono}
        >
          {(a) => (
            <input
              {...a}
              ref={(el) => { campi.current.telefono = el; }}
              type="tel"
              name="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={LIMITI.telefono}
              value={v.telefono}
              onChange={(e) => aggiorna('telefono', e.target.value)}
            />
          )}
        </Campo>
      </div>

      <Campo
        id="clb-messaggio"
        etichetta="La tua proposta"
        obbligatorio
        aiuto="Chi sei, cosa hai in mente, quando e dove: bastano poche righe."
        errore={err.messaggio}
        piede={<span className="clb-conta" aria-hidden="true">{v.messaggio.length}/{MSG_MAX}</span>}
      >
        {(a) => (
          <textarea
            {...a}
            ref={(el) => { campi.current.messaggio = el; }}
            name="message"
            rows={6}
            maxLength={MSG_MAX}
            required
            value={v.messaggio}
            onChange={(e) => aggiorna('messaggio', e.target.value)}
          />
        )}
      </Campo>

      {/* Trappola per i programmi che compilano i moduli da soli: fuori dallo
          schermo (non display:none, che certi programmi riconoscono e
          saltano), fuori dal giro del tasto Tab e nascosta ai lettori di
          schermo. Un umano non la vede, quindi resta vuota. */}
      <div className="clb-trappola" aria-hidden="true">
        <label htmlFor="clb-sito">Lascia vuoto questo campo</label>
        <input
          id="clb-sito"
          name="sito"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore="true"
          value={v.sito}
          onChange={(e) => aggiorna('sito', e.target.value)}
        />
      </div>

      <div className={`clb-privacy${err.privacy ? ' ha-errore' : ''}`}>
        {/* Tutta la riga è toccabile, non solo il quadratino. Il link si apre
            sopra la pagina (iubenda) o in una scheda nuova: il modulo resta
            compilato in ogni caso. Toccare il link non mette la spunta. */}
        <label className="clb-spunta">
          <input
            ref={(el) => { campi.current.privacy = el; }}
            type="checkbox"
            name="privacy"
            checked={v.privacy}
            onChange={(e) => aggiorna('privacy', e.target.checked)}
            required
            aria-invalid={err.privacy ? 'true' : undefined}
            aria-describedby={err.privacy ? 'clb-privacy-errore clb-privacy-nota' : 'clb-privacy-nota'}
          />
          <span>
            Ho letto l’
            <a
              href={PRIVACY_URL}
              className="iubenda-noiframe iubenda-embed"
              title="Privacy Policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              informativa privacy
            </a>
            <span className="clb-ast" aria-hidden="true"> *</span>
          </span>
        </label>
        {/* ⚠️ Se cambia questo testo o quello della spunta, va cambiato anche
            `privacy_testo` nella funzione invia_collaborazione (è la prova di
            che cosa ha accettato la persona). */}
        <p id="clb-privacy-nota" className="clb-aiuto">
          Usiamo i tuoi dati solo per rispondere a questa proposta: niente newsletter, niente
          pubblicità. La cancelliamo al più tardi dopo 24 mesi.
        </p>
        {err.privacy && <p id="clb-privacy-errore" className="clb-errore">{err.privacy}</p>}
      </div>

      {avviso && (
        <div className="clb-avviso" role="alert">
          <p>{avviso}</p>
          <a
            className="canale-chip canale-wa"
            href={linkWhatsapp(v)}
            target="_blank"
            rel="noopener noreferrer"
            data-ev="whatsapp_collabora"
          >
            <MessageCircle size={16} aria-hidden="true" /> Mandala su WhatsApp
          </a>
        </div>
      )}

      <div className="clb-azioni">
        {/* aria-disabled e non disabled: un pulsante spento perde il cursore,
            e chi usa la tastiera ripartirebbe da capo pagina. Il secondo
            tocco lo ferma `inVolo`, in invia(). */}
        <button
          type="submit"
          className="btn btn-primary clb-invia"
          aria-disabled={invio || undefined}
          aria-busy={invio || undefined}
        >
          {invio ? 'Invio in corso…' : (
            <>
              <Send size={18} aria-hidden="true" /> Invia la proposta
            </>
          )}
        </button>
        {provato && quantiErrori > 0 && (
          <p className="clb-errore clb-riassunto">
            {quantiErrori === 1 ? 'Manca ancora una cosa: è segnata in rosso.' : 'Mancano ancora alcune cose: sono segnate in rosso.'}
          </p>
        )}
        <p className="clb-alt">
          Preferisci WhatsApp?{' '}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" data-ev="whatsapp_collabora">
            Scrivici lì
          </a>
        </p>
      </div>
    </form>
  );
}
