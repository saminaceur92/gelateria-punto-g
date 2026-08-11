import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import TableEditor from './TableEditor';
import OrdersPanel from './OrdersPanel';
import StaffPanel from './StaffPanel';
import DocumentiPanel from './DocumentiPanel';
import GalleryPanel from './GalleryPanel';
import PromemoriaPanel from './PromemoriaPanel';
import CakeConfigurator from '../components/CakeConfigurator';
import { CakeDataProvider } from '../data/CakeDataProvider';
import { playPing } from '../lib/ping';

const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

const TAG_OPTIONS = [
  { value: 'firma', label: 'firma' },
  { value: 'stagione', label: 'stagione' },
];

// I 7 allergeni (Reg. UE 1169/2011). I `value` DEVONO combaciare con la pagina
// pubblica /allergeni (ALLERGEN_META in src/pages/Allergeni.jsx) per icone e link.
const ALLERGENI_OPTIONS = [
  { value: 'Glutine', emoji: '🌾' },
  { value: 'Latte', emoji: '🥛' },
  { value: 'Uova', emoji: '🥚' },
  { value: 'Soia', emoji: '🫛' },
  { value: 'Arachidi', emoji: '🥜' },
  { value: 'Frutta a guscio', emoji: '🌰' },
  { value: 'Solfiti', emoji: '🍷' },
];

export default function Dashboard() {
  const { user, signOut, isOwner } = useAuth();
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState('ordini');
  const [cfgOpen, setCfgOpen] = useState(false);
  const [ordersKey, setOrdersKey] = useState(0);
  const [newCount, setNewCount] = useState(0); // ordini arrivati mentre NON sei su "Ordini"
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    supabase.from('categorie').select('id, nome').order('ordine').then(({ data }) => setCats(data || []));
  }, []);

  // Avviso globale nuovi ordini: pallino rosso + suono anche se sei su un'altra scheda.
  useEffect(() => {
    if (!supabase) return undefined;
    const ch = supabase
      .channel('dash-nuovi-ordini')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ordini' }, () => {
        if (activeRef.current !== 'ordini') {
          playPing();
          setNewCount((c) => c + 1);
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Azzera il contatore quando apri la scheda Ordini
  useEffect(() => {
    if (active === 'ordini') setNewCount(0);
  }, [active]);

  // Notifica anche nel titolo della scheda del browser (se è in secondo piano)
  useEffect(() => {
    const base = 'Punto Gi — Gestione';
    document.title = newCount > 0 ? `(${newCount}) ${base}` : base;
  }, [newCount]);

  const catOptions = useMemo(() => cats.map((c) => ({ value: c.id, label: c.nome })), [cats]);
  const firstCat = cats[0]?.id || '';

  // Definizione di tutte le sezioni gestibili
  const sections = useMemo(
    () => [
      {
        key: 'allergeni',
        label: '🍦 Gusti e allergeni',
        props: {
          table: 'allergeni_prodotti',
          title: 'Gusti e allergeni',
          subtitle: 'Lista unica: alimenta sia la carta del gelato (menu) sia la pagina pubblica "Allergeni". Per ogni gusto imposta categoria, colore, allergeni e flag dieta. ⚠️ Dato di sicurezza: verifica sempre prima di pubblicare.',
          fields: [
            { key: 'categoria', label: 'Categoria', type: 'select', options: [
              { value: 'base', label: 'Basi' },
              { value: 'crema', label: 'Creme Classiche' },
              { value: 'golosone', label: 'Golosoni' },
              { value: 'frutta-vegan', label: 'Frutta e Vegan' },
              { value: 'leccornie', label: 'Altre Leccornie' },
            ] },
            { key: 'gusto', label: 'Gusto', type: 'text' },
            // Frase che i clienti leggono nella carta, sotto al nome del gusto.
            { key: 'descrizione', label: 'Descrizione', type: 'textarea', placeholder: 'Come lo racconti al cliente: compare nella carta sotto al nome del gusto' },
            { key: 'colore', label: 'Colore', type: 'color' },
            { key: 'tag', label: 'Tag', type: 'select', options: TAG_OPTIONS },
            { key: 'base', label: 'Base', type: 'text', placeholder: 'Bianca / Vegan / Frutta' },
            { key: 'ingredienti', label: 'Ingredienti', type: 'text' },
            // `tone` colora i due riquadri come nella pagina pubblica /allergeni
            // (azzurro = presenti, ambra = tracce): non si confondono a colpo d'occhio.
            { key: 'allergeni_certi', label: '⚠️ Allergeni presenti', type: 'checkboxes', options: ALLERGENI_OPTIONS, tone: 'certo' },
            { key: 'allergeni_tracce', label: 'Possibili tracce', type: 'checkboxes', options: ALLERGENI_OPTIONS, tone: 'traccia' },
            { key: 'vegan', label: 'Vegan', type: 'checkbox' },
            { key: 'senza_glutine', label: 'Senza glutine', type: 'checkbox' },
            { key: 'senza_lattosio', label: 'Senza lattosio', type: 'checkbox' },
            { key: 'senza_zucchero', label: 'Senza zuccheri', type: 'checkbox' },
            { key: 'per_torte', label: '🎂 Per torte', type: 'checkbox' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
          ],
          newRow: () => ({ categoria: 'crema', gusto: 'Nuovo gusto', descrizione: '', colore: '#f5d97a', tag: null, base: 'Bianca', ingredienti: '', allergeni_certi: '', allergeni_tracce: '', vegan: false, senza_glutine: true, senza_lattosio: false, senza_zucchero: false, per_torte: false, attivo: true, ordine: 100 }),
        },
      },
      {
        key: 'basi',
        label: 'Basi',
        props: {
          table: 'basi',
          title: 'Basi delle torte',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
            { key: 'colore', label: 'Colore (3D)', type: 'color' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova base', descrizione: '', supplemento: 0, colore: '#e8d2a8', allergeni: '' }),
        },
      },
      {
        key: 'crumble',
        label: 'Crumble',
        props: {
          table: 'crumble',
          title: 'Tipi di crumble',
          subtitle: 'Compaiono nel configuratore solo a chi sceglie la base "Crumble croccante": aggiungi o disattiva i tipi che hai in laboratorio.',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
            { key: 'colore', label: 'Colore (3D)', type: 'color' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo crumble', descrizione: '', supplemento: 0, colore: '#b88c5a', allergeni: '' }),
        },
      },
      {
        key: 'farciture',
        label: 'Farciture',
        props: {
          table: 'farciture',
          title: 'Farciture',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
            { key: 'colore', label: 'Colore (3D)', type: 'color' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova farcitura', descrizione: '', supplemento: 0, colore: '#c8842b', allergeni: '' }),
        },
      },
      {
        key: 'coperture',
        label: 'Coperture',
        props: {
          table: 'coperture',
          title: 'Coperture / glasse',
          subtitle: 'Coperture legate alla grafica 3D: attiva o disattiva quelle disponibili.',
          locked: true,
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
            { key: 'colore', label: 'Colore (3D)', type: 'color' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova copertura', descrizione: '', supplemento: 0, colore: '#fff8e6', allergeni: '' }),
        },
      },
      {
        key: 'decorazioni',
        label: 'Topping',
        props: {
          table: 'decorazioni',
          title: 'Topping / decorazioni',
          subtitle: 'Topping legati alla grafica 3D: attiva o disattiva quelli disponibili. Il supplemento si somma al prezzo della torta. Se la decorazione esiste in più colori, spunta "Colore a scelta" ed elenca qui i colori: il cliente sceglierà il suo.',
          locked: true,
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'emoji', label: 'Emoji', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
            // I colori si scrivono a mano: il configuratore li mostra come scelta
            // solo se "Colore a scelta" è spuntato.
            { key: 'colori', label: 'Colori', type: 'text', placeholder: 'colori separati da virgola: rosa, rossa, azzurra…' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
            { key: 'scelta_colore', label: '🎨 Colore a scelta', type: 'checkbox' },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo topping', descrizione: '', emoji: '✨', supplemento: 0, colori: '', scelta_colore: false, allergeni: '' }),
        },
      },
      {
        // Stile della scritta sulla torta: prima erano tre caratteri fissi nel sito,
        // ora si gestiscono da qui.
        key: 'scritte',
        label: 'Scritte',
        props: {
          table: 'scritte',
          title: 'Scritte sulla torta',
          subtitle: "Gli stili di scrittura fra cui il cliente sceglie per la dedica: nessuno costa di più, cambia solo l'aspetto. Il carattere è un dato tecnico (es. 'Caveat', cursive): se non sei sicura, lascialo com'è.",
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'font_family', label: 'Carattere (tecnico)', type: 'text', placeholder: "'Caveat', cursive" },
            { key: 'esempio', label: 'Esempio', type: 'text', placeholder: 'Auguri!' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
            { key: 'maiuscolo', label: 'Tutto maiuscolo', type: 'checkbox' },
            { key: 'corsivo', label: 'Inclinato', type: 'checkbox' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova scritta', font_family: "'Inter', sans-serif", esempio: 'Auguri!', maiuscolo: false, corsivo: false, attivo: true, ordine: 100 }),
        },
      },
      {
        // Prodotti che il cliente aggiunge all'ordine oltre alla torta
        // (salame dolce, cabaret di pasticcini…).
        key: 'extra',
        label: 'Extra',
        props: {
          table: 'extra',
          title: 'Extra da aggiungere alla torta',
          subtitle: 'Quello che il cliente può mettere nel suo ordine oltre alla torta: salame dolce, cabaret di pasticcini… Scrivi il prezzo di UNA unità e come la vendi (al kg, a cabaret).',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'prezzo', label: 'Prezzo €', type: 'number' },
            { key: 'unita', label: 'Unità', type: 'text', placeholder: 'al kg / a cabaret' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo extra', descrizione: '', prezzo: 0, unita: 'a pezzo', allergeni: '', attivo: true, ordine: 100 }),
        },
      },
      {
        key: 'tipi_torta',
        label: 'Tipi torta',
        props: {
          table: 'tipi_torta',
          title: 'Tipi di torta',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'prezzo_base', label: 'Prezzo base €', type: 'number' },
            { key: 'colore', label: 'Colore', type: 'color' },
            { key: 'allergeni', label: 'Allergeni', type: 'checkboxes', options: ALLERGENI_OPTIONS },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo tipo', descrizione: '', prezzo_base: 0, immagine: '/torte.jpg', colore: '#b651e4', allergeni: '' }),
        },
      },
      {
        key: 'dimensioni',
        label: 'Dimensioni',
        props: {
          table: 'dimensioni',
          title: 'Dimensioni torta',
          fields: [
            { key: 'etichetta', label: 'Etichetta', type: 'text' },
            { key: 'diametro', label: 'Diametro cm', type: 'number' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
          ],
          newRow: () => ({ id: uuid(), etichetta: '', diametro: 0, supplemento: 0 }),
        },
      },
      {
        key: 'forme',
        label: 'Forme',
        props: {
          table: 'forme',
          title: 'Forme torta',
          subtitle: 'Forme legate alla grafica 3D: attiva o disattiva quelle disponibili.',
          locked: true,
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'emoji', label: 'Emoji', type: 'text' },
            { key: 'supplemento', label: 'Supplemento €', type: 'number' },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova forma', descrizione: '', emoji: '⬤', supplemento: 0 }),
        },
      },
      {
        key: 'occasioni',
        label: 'Occasioni',
        props: {
          table: 'occasioni',
          title: 'Occasioni',
          fields: [{ key: 'nome', label: 'Nome', type: 'text' }],
          newRow: () => ({ nome: '' }),
        },
      },
      // ── In fondo, appena prima di "Accessi staff": le schede che non sono
      //    contenuti del menù ma strumenti (documenti, promemoria, orari).
      {
        // PDF allergeni caricabile dallo staff + QR Code da stampare.
        key: 'documenti',
        label: '📄 PDF e QR allergeni',
        custom: true,
      },
      {
        // Foto della gallery del sito: caricamento ed eliminazione.
        key: 'gallery',
        label: '🖼️ Foto della gallery',
        custom: true,
      },
      {
        key: 'codici_sconto',
        label: '🏷️ Codici sconto',
        props: {
          table: 'codici_sconto',
          title: 'Codici sconto',
          subtitle: 'I codici che i clienti possono scrivere alla fine dell\'ordine online. "Percentuale" toglie una percentuale dal totale (valore 10 = −10%), "Fisso" toglie tanti euro (valore 5 = −5€). Lascia vuota la scadenza se non deve scadere e gli utilizzi massimi se può essere usato all\'infinito. Il codice si scrive da solo in MAIUSCOLO: il cliente può scriverlo come vuole.',
          fields: [
            { key: 'codice', label: 'Codice', type: 'text', placeholder: 'ESTATE10' },
            { key: 'descrizione', label: 'A cosa serve', type: 'text', placeholder: 'promo estate sui social' },
            { key: 'tipo', label: 'Tipo', type: 'select', options: [
              { value: 'percentuale', label: 'Percentuale (−%)' },
              { value: 'fisso', label: 'Importo fisso (−€)' },
            ] },
            { key: 'valore', label: 'Valore', type: 'number' },
            { key: 'minimo', label: 'Spesa minima €', type: 'number' },
            { key: 'scadenza', label: 'Scade il', type: 'date' },
            { key: 'usi_max', label: 'Utilizzi massimi', type: 'number' },
            { key: 'usi', label: 'Già usato (volte)', type: 'number' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
          ],
          newRow: () => ({ id: uuid(), codice: '', descrizione: '', tipo: 'percentuale', valore: 10, minimo: 0, scadenza: null, usi_max: null, usi: 0, attivo: true }),
        },
      },
      {
        // Le due schede qui sotto stanno accanto a "PDF e QR allergeni" perché
        // è lì che si preme "Genera e pubblica": si scrive il testo e subito
        // dopo si rifà il quaderno, senza girare per il gestionale.
        key: 'quaderno-testi',
        label: '📖 Testi del quaderno',
        props: {
          table: 'quaderno_testi',
          title: 'Testi del quaderno allergeni',
          subtitle: 'Le parti scritte del PDF: copertina, "la nostra filosofia", l\'elenco di legge dei 14 allergeni e la guida alla consultazione. Finiscono nel documento quando premi "Genera e pubblica" nella scheda "PDF e QR allergeni". Per rientrare una riga (i punti a, b, c) mettici due o più spazi davanti.',
          fields: [
            { key: 'titolo', label: 'Titolo', type: 'text', placeholder: 'compare in grassetto sopra al testo' },
            { key: 'testo', label: 'Testo', type: 'textarea' },
            { key: 'posizione', label: 'Dove va nel PDF', type: 'select', options: [
              { value: 'copertina', label: 'In copertina' },
              { value: 'apertura', label: 'Prima delle tabelle' },
              { value: 'glossario', label: 'Sopra al glossario additivi' },
              { value: 'chiusura', label: 'In fondo al quaderno' },
            ] },
            // Nome interno: lo usa il codice per riconoscere la frase della
            // copertina. Si cambia solo sapendo cosa si sta facendo.
            { key: 'chiave', label: 'Nome interno', type: 'text', placeholder: 'senza spazi, es. filosofia' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
          ],
          newRow: () => ({ id: uuid(), chiave: `testo-${Date.now()}`, titolo: 'Nuovo testo', testo: '', posizione: 'apertura', attivo: true, ordine: 100 }),
        },
      },
      {
        key: 'additivi',
        label: '🧪 Additivi (E-xxx)',
        props: {
          table: 'additivi',
          title: 'Glossario degli additivi',
          subtitle: 'Le sigle E-xxx che compaiono nelle liste ingredienti, spiegate una per una. Vengono stampate in fondo al quaderno allergeni.',
          fields: [
            { key: 'codice', label: 'Sigla', type: 'text', placeholder: 'E330' },
            { key: 'nome', label: 'Nome', type: 'text', placeholder: 'Acido citrico' },
            { key: 'descrizione', label: 'A cosa serve', type: 'textarea' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
          ],
          newRow: () => ({ id: uuid(), codice: 'E000', nome: 'Nuovo additivo', descrizione: '', attivo: true, ordine: 1000 }),
        },
      },
      {
        // Promemoria compleanno: coda + storico degli invii automatici.
        key: 'promemoria',
        label: '🎂 Promemoria',
        custom: true,
      },
      {
        key: 'orari',
        label: '🕒 Orari',
        props: {
          table: 'orari',
          title: 'Orari di apertura',
          subtitle: 'Cambia gli orari per la stagione (scrivi "Chiuso" se serve).',
          fields: [
            { key: 'giorno', label: 'Giorno', type: 'text' },
            { key: 'orario', label: 'Orario', type: 'text', placeholder: '15:00 – 23:00' },
          ],
          newRow: () => ({ giorno: '', orario: '' }),
        },
      },
    ],
    [catOptions, firstCat]
  );

  const current = sections.find((s) => s.key === active) || sections[0];

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-brand">
          <strong>Punto Gi</strong> <span>Gestione contenuti</span>
        </div>
        <div className="adm-user">
          <span>{user?.email}</span>
          <button className="adm-btn" onClick={signOut}>Esci</button>
        </div>
      </header>

      <nav className="adm-nav">
        <button className="adm-tab adm-new-cake" onClick={() => setCfgOpen(true)}>
          🎂 Nuova torta
        </button>
        <button
          className={`adm-tab adm-tab-orders ${active === 'ordini' ? 'active' : ''}`}
          onClick={() => setActive('ordini')}
        >
          📦 Ordini
          {newCount > 0 && <span className="adm-badge-new">{newCount > 9 ? '9+' : newCount}</span>}
        </button>
        {sections.map((s) => (
          <button
            key={s.key}
            className={`adm-tab ${active === s.key ? 'active' : ''}`}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </button>
        ))}
        {isOwner && (
          <button
            className={`adm-tab ${active === 'staff' ? 'active' : ''}`}
            onClick={() => setActive('staff')}
          >
            👥 Accessi staff
          </button>
        )}
      </nav>

      <main className="adm-main">
        {active === 'ordini' ? (
          <OrdersPanel key={ordersKey} />
        ) : active === 'staff' && isOwner ? (
          <StaffPanel />
        ) : active === 'documenti' ? (
          <DocumentiPanel />
        ) : active === 'gallery' ? (
          <GalleryPanel />
        ) : active === 'promemoria' ? (
          <PromemoriaPanel />
        ) : (
          <TableEditor key={current.key} {...current.props} />
        )}
      </main>

      <CakeDataProvider>
        <CakeConfigurator
          open={cfgOpen}
          staff
          onClose={() => {
            setCfgOpen(false);
            setActive('ordini');
            setOrdersKey((k) => k + 1);
          }}
        />
      </CakeDataProvider>
    </div>
  );
}
