import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { logAction } from '../lib/log';
import { playPing } from '../lib/ping';
import ChiediCodice from './ChiediCodice';
import { linkDownloadFoto } from '../lib/cakePhoto';
import { noteClienteDi, fondiAggiornamento, notaDaSalvare, bozzaSuperata } from '../lib/noteOrdine';

const STATI = [
  { value: 'da_fare', label: 'Da fare', color: '#b651e4' },
  { value: 'in_lavorazione', label: 'In lavorazione', color: '#2a7ad6' },
  { value: 'pronto', label: 'Pronto', color: '#eb911e' },
  { value: 'consegnato', label: 'Consegnato', color: '#46a85a' },
  { value: 'annullato', label: 'Annullato', color: '#b03a3a' },
];
// Stati finali: ordine chiuso, niente countdown alla scadenza.
const FINALI = ['consegnato', 'annullato'];

// Formato date uniforme (gg/mm/aaaa) in tutta la dashboard.
const fmtDate = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return val;
  }
};
const fmtDateTime = (val) => {
  if (!val) return '';
  try {
    return new Date(val).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return val;
  }
};

// Urgenza in base alla data di ritiro (priorità produzione).
function urgency(ritiro) {
  if (!ritiro) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${ritiro}T00:00:00`);
  const days = Math.round((d - today) / 86400000);
  if (days < 0) return { label: 'Scaduto', color: '#b03a3a', level: 3 };
  if (days === 0) return { label: 'Oggi', color: '#b03a3a', level: 3 };
  if (days === 1) return { label: 'Domani', color: '#eb911e', level: 2 };
  if (days <= 3) return { label: `tra ${days} giorni`, color: '#eb911e', level: 1 };
  return { label: `tra ${days} giorni`, color: '#8a8a8a', level: 0 };
}

// Ordine "scaduto": ritiro già passato e ancora da gestire (non chiuso).
const isScaduto = (o) => !FINALI.includes(o.stato) && urgency(o.ritiro_data)?.label === 'Scaduto';

// Le due note dello staff su un ordine. Si scrivono e si salvano allo stesso
// modo; cambiano solo la voce nello storico e cosa si salva quando il testo è
// vuoto: le note di laboratorio '' come hanno sempre fatto, le note future
// (colonna nuova, migrazione 2026-10-09-dashboard-ottobre) "nessuna nota".
const NOTE_STAFF = {
  note_lab: { log: 'Nota ordine aggiornata', vuota: '' },
  note_future: { log: 'Note future aggiornate', vuota: null },
};
const chiaveNota = (id, colonna) => `${id}:${colonna}`;

// Gli errori del database arrivano in inglese: se manca la colonna delle note
// future, il problema è la migrazione non ancora eseguita, e va detto così.
function messaggioNota(msg = '') {
  if (/note_future/.test(msg) && /does not exist|schema cache|could not find/i.test(msg)) {
    return 'Le «Note future» non sono ancora attive: va eseguita una volta su Supabase la migrazione migrations/2026-10-09-dashboard-ottobre.sql.';
  }
  return msg;
}

export default function OrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('da_fare');
  const [sortBy, setSortBy] = useState('ritiro');
  const [openId, setOpenId] = useState(null);
  // Note dello staff in modifica (laboratorio e «Note future»), per ordine e
  // colonna: `id:colonna` → { testo, base }. `base` è il testo salvato quando
  // si è cominciato a scrivere: se intanto cambia da un altro dispositivo, lo
  // si dice prima di sovrascriverlo.
  const [bozze, setBozze] = useState({});
  const [notaSalvata, setNotaSalvata] = useState(null); // `id:colonna` appena salvata (feedback)
  // «Note future» aperte (id → true): chiuse di default, si aprono col pulsante.
  const [futureAperte, setFutureAperte] = useState({});
  const [alertOrder, setAlertOrder] = useState(null); // nuovo ordine arrivato live

  async function load() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase.from('ordini').select('*');
    if (error) setError(error.message);
    else setOrders(data || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    if (!supabase) return undefined;
    // Tempo reale: nuovi ordini / aggiornamenti / eliminazioni compaiono da soli.
    const ch = supabase
      .channel('ordini-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, (payload) => {
        const o = payload.new;
        setOrders((os) => (os.some((x) => x.id === o.id) ? os : [o, ...os]));
        setAlertOrder(o);
        playPing();
        setTimeout(() => setAlertOrder((a) => (a && a.id === o.id ? null : a)), 9000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ordini' }, (payload) => {
        // Alcuni aggiornamenti automatici (esito mail, retry, stato) possono
        // arrivare come payload parziali. Fondiamo i dati invece di sostituire
        // l'intero ordine, così dettagli e foto cialda non spariscono dalla UI
        // (vedi fondiAggiornamento in src/lib/noteOrdine.js).
        setOrders((os) => os.map((x) => (x.id === payload.new.id ? fondiAggiornamento(x, payload.new) : x)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ordini' }, (payload) => {
        setOrders((os) => os.filter((x) => x.id !== payload.old.id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // "Pronto" ed "elimina" chiedono il codice personale: sono le due azioni su
  // cui, se qualcosa va storto, serve sapere chi è stato. Gli altri passaggi di
  // stato (in lavorazione, consegnato) restano scorrevoli come prima.
  const [chiedi, setChiedi] = useState(null);

  async function applicaStato(id, stato, chi) {
    const patch = { stato };
    if (stato === 'pronto') {
      patch.pronto_da = chi?.nome || null;
      patch.pronto_il = new Date().toISOString();
    }
    const { error } = await supabase.from('ordini').update(patch).eq('id', id);
    if (error) { setError(error.message); return; }
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function setStato(id, stato) {
    const o = orders.find((x) => x.id === id);
    const label = (STATI.find((s) => s.value === stato) || {}).label || stato;
    if (stato === 'pronto') {
      setChiedi({
        azione: 'Ordine segnato Pronto',
        dettaglio: o?.cliente_nome || 'ordine',
        descrizione: `Stai segnando come PRONTO l'ordine di ${o?.cliente_nome || 'un cliente'}. Metti il tuo codice.`,
        onFatto: (chi) => { setChiedi(null); applicaStato(id, stato, chi); },
      });
      return;
    }
    await applicaStato(id, stato, null);
    logAction('Ordine spostato', `${o?.cliente_nome || 'ordine'} → ${label}`);
  }

  async function remove(id) {
    const o = orders.find((x) => x.id === id);
    if (!window.confirm("Eliminare questo ordine? L'operazione non è reversibile.")) return;
    setChiedi({
      azione: 'Ordine eliminato',
      dettaglio: o?.cliente_nome || 'ordine',
      descrizione: `Stai eliminando l'ordine di ${o?.cliente_nome || 'un cliente'}. Non si torna indietro: metti il tuo codice.`,
      onFatto: async () => {
        setChiedi(null);
        const { error } = await supabase.from('ordini').delete().eq('id', id);
        if (error) { setError(error.message); return; }
        setOrders((os) => os.filter((x) => x.id !== id));
      },
    });
  }

  // Testo di una nota dello staff come si vede nella casella: la bozza, se
  // la si sta scrivendo, altrimenti quello salvato.
  const testoNota = (o, colonna) => bozze[chiaveNota(o.id, colonna)]?.testo ?? o[colonna] ?? '';
  const notaCambiata = (o, colonna) => testoNota(o, colonna) !== (o[colonna] ?? '');
  const scriviNota = (o, colonna, testo) => setBozze((b) => {
    const k = chiaveNota(o.id, colonna);
    return { ...b, [k]: { testo, base: b[k] ? b[k].base : (o[colonna] ?? '') } };
  });
  const scartaBozza = (id, colonna) => setBozze((b) => {
    const n = { ...b };
    delete n[chiaveNota(id, colonna)];
    return n;
  });

  async function salvaNota(id, colonna) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const k = chiaveNota(id, colonna);
    const { log, vuota } = NOTE_STAFF[colonna];
    const valore = notaDaSalvare(testoNota(o, colonna), vuota);
    setError('');
    const { data, error } = await supabase.from('ordini').update({ [colonna]: valore }).eq('id', id).select('id');
    if (error) { setError(messaggioNota(error.message)); return; }
    // Un aggiornamento fermato dai permessi non dà errore: semplicemente non
    // tocca nessuna riga. Senza questo controllo comparirebbe "Salvata".
    if (!data?.length) {
      setError('Nota non salvata: il database non ha accettato la modifica. Esci e rientra col tuo codice, poi riprova.');
      return;
    }
    setOrders((os) => os.map((x) => (x.id === id ? { ...x, [colonna]: valore } : x)));
    scartaBozza(id, colonna);
    logAction(log, o.cliente_nome || 'ordine');
    setNotaSalvata(k);
    setTimeout(() => setNotaSalvata((s) => (s === k ? null : s)), 2000);
  }

  // Avviso sotto la casella quando un altro dispositivo ha salvato un testo
  // diverso mentre qui si scriveva: salvando, vince l'ultimo.
  const avvisoSuperata = (o, colonna) => (
    bozzaSuperata(bozze[chiaveNota(o.id, colonna)], o[colonna]) && (
      <p className="ord-nota-avviso" role="status">
        Nel frattempo da un altro dispositivo è stato salvato un testo diverso: se salvi, il tuo lo sostituisce.{' '}
        <button type="button" className="adm-link" onClick={() => scartaBozza(o.id, colonna)}>
          Mostra quello salvato
        </button>
      </p>
    )
  );

  // Filtro per stato (+ vista trasversale "Scaduto")
  let shown = orders;
  if (filter === 'scaduto') shown = orders.filter(isScaduto);
  else if (filter !== 'tutti') shown = orders.filter((o) => o.stato === filter);

  // Ordinamento
  shown = [...shown].sort((a, b) => {
    if (sortBy === 'ritiro') {
      if (!a.ritiro_data && !b.ritiro_data) return 0;
      if (!a.ritiro_data) return 1;
      if (!b.ritiro_data) return -1;
      return a.ritiro_data.localeCompare(b.ritiro_data);
    }
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const nDaFare = orders.filter((o) => o.stato === 'da_fare').length;
  const nInLav = orders.filter((o) => o.stato === 'in_lavorazione').length;
  const nScaduti = orders.filter(isScaduto).length;

  return (
    <section className="adm-card">
      <header className="adm-card-head">
        <div>
          <h3>Ordini torte</h3>
          <p>Richieste dal sito, ordinate per priorità (ritiro più vicino in cima). Aggiorna lo stato man mano che le prepari.</p>
        </div>
        <span className="adm-count">
          {nDaFare + nInLav} da gestire <span className="adm-count-detail">({nDaFare} da fare · {nInLav} in lavorazione)</span> · {orders.length} totali
          {nScaduti > 0 && <span className="ord-count-scaduti"> · ⚠ {nScaduti} scaduti</span>}
        </span>
      </header>

      {alertOrder && (
        <div className="ord-alert" role="status">
          🔔 <strong>Nuovo ordine</strong> da {alertOrder.cliente_nome || 'cliente'}
          {alertOrder.ritiro_data ? ` · ritiro ${fmtDate(alertOrder.ritiro_data)}` : ''}
          <button className="ord-alert-x" onClick={() => setAlertOrder(null)} aria-label="Chiudi">✕</button>
        </div>
      )}

      <div className="ord-filters">
        {STATI.map((s) => (
          <button key={s.value} className={filter === s.value ? 'active' : ''} onClick={() => setFilter(s.value)}>
            {s.label}
          </button>
        ))}
        <button className={`ord-f-scaduto ${filter === 'scaduto' ? 'active' : ''}`} onClick={() => setFilter('scaduto')}>
          Scaduto{nScaduti > 0 ? ` (${nScaduti})` : ''}
        </button>
        <button className={filter === 'tutti' ? 'active' : ''} onClick={() => setFilter('tutti')}>Tutti</button>
        <span className="ord-sort">
          Ordina:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="ritiro">Priorità (ritiro)</option>
            <option value="recenti">Più recenti</option>
          </select>
          <button className="ord-reload" onClick={load} title="Aggiorna">↻</button>
        </span>
      </div>

      {error && <div className="adm-error">⚠️ {error}</div>}
      {loading && <div className="adm-muted">Caricamento…</div>}
      {!loading && shown.length === 0 && <div className="adm-muted">Nessun ordine{filter !== 'tutti' ? ' in questa vista' : ' ancora'}.</div>}

      <div className="ord-list">
        {shown.map((o) => {
          const stato = STATI.find((s) => s.value === o.stato) || STATI[0];
          const open = openId === o.id;
          const tel = (o.cliente_telefono || '').replace(/\D/g, '');
          // Il countdown alla scadenza c'è sempre, finché l'ordine non è chiuso.
          const urg = FINALI.includes(o.stato) ? null : urgency(o.ritiro_data);
          const gusti = Array.isArray(o.dettagli?.flavors) ? o.dettagli.flavors.map((f) => f.name).filter(Boolean).join(', ') : '';
          // Bordo sinistro: rosso se scaduto, grigio se annullato, altrimenti il colore dello stato.
          const overdue = isScaduto(o);
          const borderCol = overdue ? '#b03a3a' : o.stato === 'annullato' ? '#c9c9c9' : stato.color;
          // Solo la foto caricata dal cliente per la cialda è scaricabile.
          // `o.immagine` resta invece la miniatura del modello 3D.
          const fotoCialda = o.dettagli?.fotoCialdaUrl || null;
          // Le note del cliente stanno nella card, sempre in vista: prima si
          // leggevano solo aprendo «Dettagli», ed era facile non vederle.
          const notaCliente = noteClienteDi(o);
          // «Note future»: il pulsante compare solo quando la colonna esiste
          // (migrazione eseguita). Prima, select('*') non restituisce la chiave.
          const conFuture = 'note_future' in o;
          const futureAperta = !!futureAperte[o.id];

          return (
            <div key={o.id} className={`ord-card ${overdue ? 'scaduto' : ''}`} style={{ borderLeftColor: borderCol }}>
              <div className="ord-row">
                {o.immagine && <img className="ord-img" src={o.immagine} alt="Torta configurata" loading="lazy" />}
                <div className="ord-body">
                  <div className="ord-top">
                    <div className="ord-who">
                      <strong>{o.cliente_nome || 'Senza nome'}</strong>
                      <span className="ord-meta">{o.tipo || 'Torta'} · €{Number(o.totale || 0).toFixed(2)}</span>
                    </div>
                    <div className="ord-badges">
                      {urg && <span className="ord-badge" style={{ background: urg.color }}>{urg.label}</span>}
                      <span className="ord-badge ord-badge-stato" style={{ background: stato.color }}>{stato.label}</span>
                    </div>
                  </div>

                  {gusti && <div className="ord-gusti">🍰 {gusti}</div>}
                  {notaCliente && (
                    <div className="ord-note-cliente" role="note">
                      <span className="ord-note-tit">💬 Note del cliente</span>
                      <p>{notaCliente}</p>
                    </div>
                  )}
                  {o.note_lab && <div className="ord-lab-preview">📝 {o.note_lab}</div>}

                  <div className="ord-info">
                    <span>🗓️ Prenotato {fmtDateTime(o.created_at)}</span>
                    {o.ritiro_data && <span>🛍️ Ritiro {fmtDate(o.ritiro_data)}{o.ritiro_ora ? ` alle ${o.ritiro_ora}` : ''}</span>}
                    {o.cliente_telefono && <span>📞 {o.cliente_telefono}</span>}
                    {o.dettagli?.pagamentoStaff === 'pagata' && <span>✅ Già pagata</span>}
                    {o.dettagli?.pagamentoStaff === 'ritiro' && <span>💶 Paga al ritiro</span>}
                  </div>

                  <div className="ord-actions">
                    <select value={o.stato} onChange={(e) => setStato(o.id, e.target.value)}>
                      {STATI.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button className="adm-btn" onClick={() => setOpenId(open ? null : o.id)}>
                      {open ? 'Nascondi' : 'Dettagli'}
                    </button>
                    {conFuture && (
                      <button
                        type="button"
                        className={`adm-btn ord-btn-future ${futureAperta ? 'aperto' : ''}`}
                        aria-expanded={futureAperta}
                        aria-controls={`ord-future-${o.id}`}
                        onClick={() => setFutureAperte((a) => ({ ...a, [o.id]: !a[o.id] }))}
                      >
                        🗒️ Note future
                        {/* Pallino: su questo ordine c'è già qualcosa di scritto. */}
                        {o.note_future && (
                          <span className="ord-pallino">
                            <span className="adm-sr"> (ci sono note scritte)</span>
                          </span>
                        )}
                      </button>
                    )}
                    {tel && (
                      <a className="adm-btn" href={`https://api.whatsapp.com/send?phone=${tel}`} target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {/* La stessa foto caricata per la cialda arriva su Telegram. */}
                    {fotoCialda && (
                      <a
                        className="adm-btn"
                        href={linkDownloadFoto(fotoCialda, o.cliente_nome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Scarica la foto caricata per la cialda"
                      >
                        ⬇ Scarica foto cialda
                      </a>
                    )}
                    <button className="adm-btn adm-btn-del" onClick={() => remove(o.id)} title="Elimina">🗑</button>
                  </div>

                  {/* Note future: appunti dello staff su QUESTO ordine. Restano
                      qui: niente Telegram, mail o scontrino (partono tutti
                      all'arrivo dell'ordine, prima che esistano). */}
                  {conFuture && (
                    <div className="ord-future" id={`ord-future-${o.id}`} hidden={!futureAperta}>
                      <label htmlFor={`ord-future-txt-${o.id}`}>
                        🗒️ Note future <span>(interne: restano su questo ordine, il cliente non le vede)</span>
                      </label>
                      <textarea
                        id={`ord-future-txt-${o.id}`}
                        value={testoNota(o, 'note_future')}
                        placeholder="Es. per la prossima volta: …"
                        onChange={(e) => scriviNota(o, 'note_future', e.target.value)}
                      />
                      {avvisoSuperata(o, 'note_future')}
                      <button
                        type="button"
                        className="adm-btn adm-btn-save"
                        onClick={() => salvaNota(o.id, 'note_future')}
                        disabled={!notaCambiata(o, 'note_future')}
                      >
                        {notaSalvata === chiaveNota(o.id, 'note_future') ? '✓ Salvate' : 'Salva note future'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {open && (
                <>
                  {o.riepilogo && (
                    <pre className="ord-riepilogo">
                      {o.riepilogo.replace(/[*_]/g, '').replace('Stima:', 'Importo pagato:')}
                    </pre>
                  )}
                  {/* Le note del cliente non si ripetono qui: stanno nella card. */}
                  <div className="ord-lab">
                    <label htmlFor={`ord-lab-txt-${o.id}`}>📝 Note di laboratorio <span>(interne, non visibili al cliente)</span></label>
                    <textarea
                      id={`ord-lab-txt-${o.id}`}
                      value={testoNota(o, 'note_lab')}
                      placeholder="Es. allergie, scaffale, da richiamare…"
                      onChange={(e) => scriviNota(o, 'note_lab', e.target.value)}
                    />
                    {avvisoSuperata(o, 'note_lab')}
                    <button
                      className="adm-btn adm-btn-save"
                      onClick={() => salvaNota(o.id, 'note_lab')}
                      disabled={!notaCambiata(o, 'note_lab')}
                    >
                      {notaSalvata === chiaveNota(o.id, 'note_lab') ? '✓ Salvata' : 'Salva nota'}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {chiedi && (
        <ChiediCodice
          azione={chiedi.azione}
          dettaglio={chiedi.dettaglio}
          descrizione={chiedi.descrizione}
          onFatto={chiedi.onFatto}
          onAnnulla={() => setChiedi(null)}
        />
      )}
    </section>
  );
}
