import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import TableEditor from './TableEditor';
import OrdersPanel from './OrdersPanel';
import StaffPanel from './StaffPanel';
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
    const base = 'Punto Gi! — Gestione';
    document.title = newCount > 0 ? `(${newCount}) ${base}` : base;
  }, [newCount]);

  const catOptions = useMemo(() => cats.map((c) => ({ value: c.id, label: c.nome })), [cats]);
  const firstCat = cats[0]?.id || '';

  // Definizione di tutte le sezioni gestibili
  const sections = useMemo(
    () => [
      {
        key: 'gusti',
        label: '🍦 Gusti (menù)',
        props: {
          table: 'gusti',
          title: 'Gusti del menù gelato',
          subtitle: 'I gusti mostrati nella "carta del gelato". Spegni quelli finiti, aggiungi i nuovi.',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'categoria_id', label: 'Categoria', type: 'select', options: catOptions },
            { key: 'colore', label: 'Colore', type: 'color' },
            { key: 'tag', label: 'Tag', type: 'select', options: TAG_OPTIONS },
            { key: 'vegan', label: 'Vegan', type: 'checkbox' },
            { key: 'senza_glutine', label: 'Senza glutine', type: 'checkbox' },
            { key: 'senza_lattosio', label: 'Senza lattosio', type: 'checkbox' },
          ],
          newRow: () => ({ nome: 'Nuovo gusto', categoria_id: firstCat, colore: '#f5d97a', tag: null, vegan: false, senza_glutine: false, senza_lattosio: false }),
        },
      },
      {
        key: 'allergeni',
        label: '🛡️ Allergeni',
        props: {
          table: 'allergeni_prodotti',
          title: 'Allergeni per gusto',
          subtitle: 'Alimenta la pagina pubblica "Allergeni". Spunta gli allergeni presenti e le possibili tracce per ogni gusto. ⚠️ Dato di sicurezza: verifica sempre prima di pubblicare.',
          fields: [
            { key: 'categoria', label: 'Categoria', type: 'select', options: [
              { value: 'base', label: 'Basi' },
              { value: 'crema', label: 'Creme Classiche' },
              { value: 'golosone', label: 'Golosoni' },
              { value: 'frutta-vegan', label: 'Frutta e Vegan' },
            ] },
            { key: 'gusto', label: 'Gusto', type: 'text' },
            { key: 'base', label: 'Base', type: 'text', placeholder: 'Bianca / Vegan / Frutta' },
            { key: 'ingredienti', label: 'Ingredienti', type: 'text' },
            { key: 'allergeni_certi', label: 'Allergeni presenti', type: 'checkboxes', options: ALLERGENI_OPTIONS },
            { key: 'allergeni_tracce', label: 'Possibili tracce', type: 'checkboxes', options: ALLERGENI_OPTIONS },
            { key: 'vegan', label: 'Vegan', type: 'checkbox' },
            { key: 'senza_glutine', label: 'Senza glutine', type: 'checkbox' },
            { key: 'senza_zucchero', label: 'Senza zuccheri', type: 'checkbox' },
            { key: 'attivo', label: 'Attivo', type: 'checkbox' },
            { key: 'ordine', label: 'Ordine', type: 'number' },
          ],
          newRow: () => ({ categoria: 'crema', gusto: 'Nuovo gusto', base: 'Bianca', ingredienti: '', allergeni_certi: '', allergeni_tracce: '', vegan: false, senza_glutine: true, senza_zucchero: false, attivo: true, ordine: 100 }),
        },
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
      {
        key: 'gusti_torte',
        label: '🎂 Gusti torte',
        props: {
          table: 'gusti_torte',
          title: 'Gusti selezionabili per le torte',
          subtitle: 'Lista separata dal menù: i gusti scegliibili nel configuratore torte.',
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'colore', label: 'Colore', type: 'color' },
          ],
          newRow: () => ({ nome: 'Nuovo gusto', colore: '#f5d97a' }),
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
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova base', descrizione: '', supplemento: 0, colore: '#e8d2a8' }),
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
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova farcitura', descrizione: '', supplemento: 0, colore: '#c8842b' }),
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
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuova copertura', descrizione: '', supplemento: 0, colore: '#fff8e6' }),
        },
      },
      {
        key: 'decorazioni',
        label: 'Topping',
        props: {
          table: 'decorazioni',
          title: 'Topping / decorazioni',
          subtitle: 'Topping legati alla grafica 3D: attiva o disattiva quelli disponibili.',
          locked: true,
          fields: [
            { key: 'nome', label: 'Nome', type: 'text' },
            { key: 'descrizione', label: 'Descrizione', type: 'text' },
            { key: 'emoji', label: 'Emoji', type: 'text' },
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo topping', descrizione: '', emoji: '✨' }),
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
          ],
          newRow: () => ({ id: uuid(), nome: 'Nuovo tipo', descrizione: '', prezzo_base: 0, immagine: '/torte.jpg', colore: '#b651e4' }),
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
    ],
    [catOptions, firstCat]
  );

  const current = sections.find((s) => s.key === active) || sections[0];

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-brand">
          <strong>Punto Gi!</strong> <span>Gestione contenuti</span>
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
