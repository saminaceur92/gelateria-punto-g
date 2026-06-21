import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './auth';
import TableEditor from './TableEditor';
import OrdersPanel from './OrdersPanel';

const uuid = () => (window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

const TAG_OPTIONS = [
  { value: 'firma', label: 'firma' },
  { value: 'stagione', label: 'stagione' },
];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [cats, setCats] = useState([]);
  const [active, setActive] = useState('ordini');

  useEffect(() => {
    supabase.from('categorie').select('id, nome').order('ordine').then(({ data }) => setCats(data || []));
  }, []);

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
          subtitle: 'Le coperture sono legate al 3D: aggiungerne di nuove non avrà un aspetto dedicato.',
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
          subtitle: 'Le decorazioni sono legate al 3D: aggiungerne di nuove non avrà un aspetto dedicato.',
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
          subtitle: 'Le forme sono legate al 3D: aggiungerne di nuove non avrà un aspetto dedicato.',
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
          <strong>Punto G!</strong> <span>Gestione contenuti</span>
        </div>
        <div className="adm-user">
          <span>{user?.email}</span>
          <button className="adm-btn" onClick={signOut}>Esci</button>
        </div>
      </header>

      <nav className="adm-nav">
        <button
          className={`adm-tab adm-tab-orders ${active === 'ordini' ? 'active' : ''}`}
          onClick={() => setActive('ordini')}
        >
          📦 Ordini
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
      </nav>

      <main className="adm-main">
        {active === 'ordini' ? <OrdersPanel /> : <TableEditor key={current.key} {...current.props} />}
      </main>
    </div>
  );
}
