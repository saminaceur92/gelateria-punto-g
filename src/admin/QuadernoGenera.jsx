import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { DOC_ALLERGENI, caricaDocumento } from '../lib/documenti';
import { generaQuaderno, improntaDati, raccogliDati } from '../lib/quadernoPdf';

/**
 * "Genera il quaderno dai dati del gestionale".
 *
 * Il PDF ufficiale degli allergeni si costruisce dalle stesse tabelle che
 * alimentano il sito, quindi non può più dire cose diverse dalla pagina
 * pubblica. Qui dentro ci sono solo i pulsanti e l'avviso di allineamento:
 * la costruzione del documento sta in src/lib/quadernoPdf.js.
 */

const NOMI_TABELLE = {
  tipi_torta: 'Tipi di torta',
  basi: 'Basi',
  crumble: 'Crumble',
  farciture: 'Farciture',
  coperture: 'Coperture',
  decorazioni: 'Decorazioni',
  extra: 'Extra',
  quaderno_testi: 'Testi del quaderno',
  additivi: 'Additivi (E-xxx)',
  parole_evidenza: 'Parole in grassetto',
};

export default function QuadernoGenera({ doc, onPubblicato }) {
  const { user } = useAuth();
  const [dati, setDati] = useState(null);
  const [impronta, setImpronta] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const leggi = useCallback(async () => {
    const d = await raccogliDati();
    setDati(d);
    setImpronta(d.errore ? '' : improntaDati(d));
    return d;
  }, []);

  useEffect(() => {
    leggi();
  }, [leggi]);

  const nGusti = dati?.gusti?.length || 0;
  const nComponenti = (dati?.sezioniTorta || []).reduce((n, s) => n + s.voci.length, 0);

  // La colonna `generato` esiste solo dopo la migrazione 2026-08-05: se manca,
  // il PDF si genera lo stesso ma non si può dire se è ancora allineato.
  const senzaTracciamento = !!doc && !('generato' in doc);

  const stato = useMemo(() => {
    if (!dati || dati.errore) return null;
    if (!doc?.file_url) {
      return { tipo: 'mai', testo: 'Non è mai stato generato: online c’è ancora il PDF incluso nel sito.' };
    }
    if (senzaTracciamento) {
      return { tipo: 'ignoto', testo: 'Non posso sapere se il PDF pubblicato combacia con i dati: manca la migrazione qui sotto.' };
    }
    if (!doc.generato) {
      return { tipo: 'manuale', testo: 'Il PDF pubblicato è stato caricato a mano: potrebbe non combaciare con quello che c’è nel gestionale.' };
    }
    if (doc.dati_hash && doc.dati_hash === impronta) {
      return { tipo: 'ok', testo: 'Il PDF pubblicato combacia con i dati del gestionale.' };
    }
    return { tipo: 'vecchio', testo: 'I dati sono cambiati dopo l’ultima generazione: il PDF online è da rifare.' };
  }, [dati, doc, impronta, senzaTracciamento]);

  function costruisci(d) {
    return generaQuaderno(d, { quando: new Date() });
  }

  async function anteprima() {
    setBusy('anteprima');
    setErr('');
    setMsg('');
    try {
      const d = await leggi();
      if (d.errore) { setErr(d.errore); return; }
      const { blob, pagine } = costruisci(d);
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank', 'noopener');
      if (!w) {
        // Finestra bloccata dal browser: si scarica e basta.
        const a = document.createElement('a');
        a.href = url;
        a.download = 'anteprima-quaderno-allergeni.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setMsg(`Anteprima pronta (${pagine} pagine). Non è ancora pubblicata: online resta il PDF di prima.`);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      setErr(e?.message || 'Non sono riuscito a costruire il PDF.');
    } finally {
      setBusy('');
    }
  }

  async function pubblica() {
    const conferma = window.confirm(
      'Il quaderno generato adesso diventa il documento ufficiale: sostituisce quello che si scarica dalla pagina Allergeni e dal QR Code.\n\nLa versione di prima non viene cancellata.\n\nProcedo?',
    );
    if (!conferma) return;
    setBusy('pubblica');
    setErr('');
    setMsg('');
    try {
      const d = await leggi();
      if (d.errore) { setErr(d.errore); return; }
      const { blob, nome, pagine } = costruisci(d);
      const file = new File([blob], nome, { type: 'application/pdf' });
      const { error } = await caricaDocumento({
        chiave: DOC_ALLERGENI,
        file,
        titolo: 'Quaderno Ingredienti e Allergeni',
        email: user?.email,
        generato: true,
        hash: improntaDati(d),
      });
      if (error) { setErr(error); return; }
      setMsg(`Quaderno pubblicato ✔ — ${pagine} pagine, già online sulla pagina Allergeni e sul QR.`);
      if (onPubblicato) await onPubblicato();
    } catch (e) {
      setErr(e?.message || 'Non sono riuscito a pubblicare il PDF.');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>🧾 Genera il quaderno dai dati del gestionale</h3>
          <p>
            Costruisce il PDF ufficiale degli allergeni partendo dalla scheda <strong>Gusti e allergeni</strong>
            {' '}(più basi, crumble, farciture, coperture, decorazioni ed extra). Sono gli stessi dati che vedono i
            clienti sul sito: così il documento e la pagina non possono dire cose diverse.
          </p>
        </div>
      </header>

      {err && <div className="adm-error">⚠️ {err}</div>}
      {msg && <div className="adm-info">{msg}</div>}
      {dati?.errore && <div className="adm-error">⚠️ {dati.errore}</div>}
      {!dati && <div className="adm-muted">Leggo i dati…</div>}

      {stato && (
        <div className={`qg-stato qg-${stato.tipo}`}>
          <span className="qg-punto" aria-hidden="true" />
          <div>
            <strong>
              {stato.tipo === 'ok' && 'Documento allineato'}
              {stato.tipo === 'vecchio' && 'Quaderno da rigenerare'}
              {stato.tipo === 'manuale' && 'Allineamento non garantito'}
              {stato.tipo === 'mai' && 'Quaderno mai generato'}
              {stato.tipo === 'ignoto' && 'Controllo non attivo'}
            </strong>
            <span>{stato.testo}</span>
          </div>
        </div>
      )}

      {dati && !dati.errore && (
        <p className="adm-muted qg-conteggio">
          Nel documento finiscono <strong>{nGusti}</strong> {nGusti === 1 ? 'gusto/prodotto' : 'gusti e prodotti'} di
          gelateria{nComponenti > 0 && <> e <strong>{nComponenti}</strong> componenti delle torte</>}, con allergeni
          presenti, possibili tracce e indicazioni vegan / senza glutine / senza lattosio / senza zuccheri.
        </p>
      )}

      {dati?.mancanti?.length > 0 && (
        <p className="adm-muted qg-conteggio">
          Non trovate in database (saltate nel documento):{' '}
          {dati.mancanti.map((t) => NOMI_TABELLE[t] || t).join(', ')}.
        </p>
      )}

      <div className="doc-actions qg-azioni">
        <button type="button" className="adm-btn" onClick={anteprima} disabled={!!busy || !dati || !!dati?.errore}>
          {busy === 'anteprima' ? 'Preparo…' : '👁 Anteprima (non pubblica)'}
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-primary"
          onClick={pubblica}
          disabled={!!busy || !dati || !!dati?.errore}
        >
          {busy === 'pubblica' ? 'Genero e pubblico…' : '✨ Genera e pubblica'}
        </button>
      </div>

      <p className="adm-muted doc-hint qg-hint">
        Guarda sempre l’anteprima prima di pubblicare. La versione precedente non viene cancellata: resta
        nell’elenco qui sotto.
      </p>

      {senzaTracciamento && (
        <div className="adm-info qg-migrazione">
          Per far comparire da solo l’avviso “il quaderno è da rigenerare”, esegui una volta la migrazione
          <code> migrations/2026-08-05-quaderno-generato.sql </code> dal SQL Editor di Supabase. Senza, il pulsante
          funziona lo stesso: manca solo il controllo automatico.
        </div>
      )}
    </section>
  );
}
