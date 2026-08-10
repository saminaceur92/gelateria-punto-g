import { useEffect, useState, useMemo } from 'react';
import { ArrowLeft, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDocumento, pdfUrl } from '../lib/documenti';

// I 7 allergeni usati in gelateria (dei 14 del Reg. UE 1169/2011) con icona.
const ALLERGEN_META = {
  Glutine: '🌾',
  Latte: '🥛',
  Uova: '🥚',
  Soia: '🫛',
  Arachidi: '🥜',
  'Frutta a guscio': '🌰',
  Solfiti: '🍷',
};

const CATEGORIE = [
  { key: 'base', title: 'Le nostre basi', hint: 'Ogni gusto parte da una di queste basi.' },
  { key: 'crema', title: 'Le Creme Classiche', hint: 'Gusti classici lisci, senza variegature.' },
  { key: 'golosone', title: 'I Nostri Golosoni', hint: 'Gusti con variegature: biscotti, granelle, creme…' },
  { key: 'frutta-vegan', title: 'Linea Frutta e Vegan', hint: 'A base acqua, senza latte né derivati animali.' },
  { key: 'leccornie', title: 'Altre Leccornie', hint: 'Pasticcini, torte, salame dolce e le altre specialità del banco.' },
];

const splitAll = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

function Chip({ name, tone }) {
  const bg = tone === 'certo' ? 'rgba(44,118,153,0.12)' : 'rgba(192,137,76,0.14)';
  const col = tone === 'certo' ? 'var(--violet-deep)' : '#9a6a2f';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3em',
      background: bg, color: col, borderRadius: 999, padding: '0.2em 0.6em',
      fontSize: '0.82rem', fontWeight: 600, margin: '0.15rem 0.25rem 0.15rem 0', whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{ALLERGEN_META[name] || '•'}</span> {name}
    </span>
  );
}

function Flag({ label, color }) {
  return (
    <span style={{
      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
      color, border: `1.5px solid ${color}`, borderRadius: 6, padding: '0.05rem 0.35rem', marginRight: '0.3rem',
    }}>{label}</span>
  );
}

// `vuoto` = testo da mostrare quando non ci sono allergeni dichiarati. Per i
// gelati la casella vuota significa davvero "nessun allergene"; per le altre
// leccornie (monoporzioni, prodotti stagionali) i titolari non li hanno
// indicati, quindi non possiamo dichiarare l'assenza: si rimanda allo staff.
function ProductCard({ p, vuoto = 'Nessuno tra i principali' }) {
  const certi = splitAll(p.allergeni_certi);
  const tracce = splitAll(p.allergeni_tracce);
  // Descrizione scritta dai titolari: campo facoltativo, per molte voci è vuoto.
  const descrizione = (p.descrizione || '').trim();
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid rgba(50,40,31,0.1)', borderRadius: 16,
      padding: '1.1rem 1.2rem', boxShadow: '0 10px 26px -18px rgba(50,40,31,0.35)',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <h3 style={{ fontSize: '1.15rem', margin: 0 }}>{p.gusto}</h3>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--grey)' }}>
          {p.vegan && <Flag label="V" color="#2e9e5b" />}
          {p.senza_glutine && <Flag label="SG" color="var(--orange)" />}
          {p.senza_lattosio && <Flag label="SL" color="var(--violet-deep)" />}
          {p.senza_zucchero && <Flag label="SZ" color="#6b4f9e" />}
          {p.base ? `Base ${p.base}` : ''}
        </span>
      </div>
      {descrizione && (
        <p style={{ fontSize: '0.92rem', color: 'var(--ink)', margin: '0 0 0.5rem', lineHeight: 1.5 }}>{descrizione}</p>
      )}
      {p.ingredienti && (
        <p style={{ fontSize: '0.85rem', color: 'var(--grey)', margin: '0 0 0.7rem', lineHeight: 1.5 }}>{p.ingredienti}</p>
      )}
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--violet-deep)' }}>Allergeni presenti</span>
          <div style={{ marginTop: '0.25rem' }}>
            {certi.length ? certi.map((a) => <Chip key={a} name={a} tone="certo" />) : <span style={{ color: 'var(--grey)', fontSize: '0.88rem' }}>{vuoto}</span>}
          </div>
        </div>
        {tracce.length > 0 && (
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a6a2f' }}>Possibili tracce</span>
            <div style={{ marginTop: '0.25rem' }}>
              {tracce.map((a) => <Chip key={a} name={a} tone="traccia" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// "luglio 2026" -> "Luglio 2026"
function meseAnno(iso) {
  if (!iso) return null;
  try {
    const s = new Date(iso).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return null;
  }
}

export default function Allergeni() {
  const [rows, setRows] = useState(null);
  // Documento ufficiale: lo staff lo aggiorna dalla dashboard (scheda "PDF e QR
  // allergeni"). Se non ne è mai stato caricato uno, resta quello del sito.
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    document.title = 'Allergeni · Gelateria Punto Gi';
    getDocumento().then(({ data }) => setDoc(data));
    if (!supabase) { setRows([]); return; }
    supabase.from('allergeni_prodotti').select('*').eq('attivo', true).order('ordine')
      .then(({ data }) => setRows(data || []));
  }, []);

  const aggiornato = (doc?.file_url && meseAnno(doc.aggiornato_il)) || 'Maggio 2026';

  const byCat = useMemo(() => {
    const m = {};
    (rows || []).forEach((r) => { (m[r.categoria] = m[r.categoria] || []).push(r); });
    return m;
  }, [rows]);

  // Se dal gestionale nasce una categoria nuova, i suoi gusti NON devono
  // sparire da questa pagina: finiscono in fondo col nome che hanno in database.
  const categorie = useMemo(() => {
    const noti = new Set(CATEGORIE.map((c) => c.key));
    const extra = Object.keys(byCat)
      .filter((k) => k && !noti.has(k))
      .map((k) => ({ key: k, title: k.charAt(0).toUpperCase() + k.slice(1).replace(/-/g, ' '), hint: '' }));
    return [...CATEGORIE, ...extra];
  }, [byCat]);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh', color: 'var(--ink)' }}>
      <header style={{ borderBottom: '1px solid rgba(50,40,31,0.1)', background: 'var(--cream)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem var(--pad-x)' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--violet-deep)' }}>
            <ArrowLeft size={18} /> Torna al sito
          </a>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>Punto Gi</span>
        </div>
      </header>

      <main className="container" style={{ padding: '2.5rem var(--pad-x) 4rem', maxWidth: 900 }}>
        <span className="eyebrow"><ShieldCheck size={16} style={{ marginRight: 6 }} /> Trasparenza e qualità artigianale</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3.2rem)', margin: '0.8rem 0 0.6rem' }}>Ingredienti e Allergeni</h1>
        <p className="lead">
          Redatto ai sensi del <strong>Regolamento (UE) n. 1169/2011</strong> per una consultazione chiara e completa
          sulle sostanze che possono provocare allergie o intolleranze. Ultimo aggiornamento: <strong>{aggiornato}</strong>.
        </p>

        {/* Avviso contaminazione crociata */}
        <div style={{ display: 'flex', gap: '0.8rem', background: 'rgba(192,137,76,0.1)', border: '1px solid rgba(192,137,76,0.3)', borderRadius: 14, padding: '1rem 1.1rem', margin: '1.6rem 0' }}>
          <AlertTriangle size={22} style={{ color: '#9a6a2f', flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, color: 'var(--ink)', fontSize: '0.92rem', lineHeight: 1.55 }}>
            <strong>Avviso importante.</strong> Tutti i gelati sono prodotti artigianalmente nello stesso laboratorio con le stesse
            attrezzature: non è possibile garantire l'assenza assoluta di contaminazioni crociate. Ogni prodotto può contenere
            <strong> tracce</strong> di glutine, latte, uova, soia, frutta a guscio e arachidi, anche se non fanno parte degli ingredienti.
          </p>
        </div>

        {/* Legenda allergeni */}
        <section style={{ margin: '2rem 0' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.8rem' }}>Legenda allergeni</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {Object.entries(ALLERGEN_META).map(([name, emoji]) => (
              <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em', background: 'var(--surface)', border: '1px solid rgba(50,40,31,0.12)', borderRadius: 999, padding: '0.4em 0.8em', fontSize: '0.9rem', fontWeight: 600 }}>
                <span aria-hidden="true" style={{ fontSize: '1.1em' }}>{emoji}</span> {name}
              </span>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey)', marginTop: '0.8rem' }}>
            {/* Stesse sigle del quaderno PDF (src/lib/quadernoPdf.js): chi legge
                il documento e chi legge la pagina deve trovare le stesse cose. */}
            <strong style={{ color: '#2e9e5b' }}>V</strong> = senza derivati animali ·
            <strong style={{ color: 'var(--orange)' }}> SG</strong> = senza glutine ·
            <strong style={{ color: 'var(--violet-deep)' }}> SL</strong> = senza lattosio ·
            <strong style={{ color: '#6b4f9e' }}> SZ</strong> = senza zuccheri aggiunti
          </p>
        </section>

        {/* Tabelle per categoria */}
        {rows === null ? (
          <p style={{ color: 'var(--grey)' }}>Caricamento…</p>
        ) : (
          categorie.map((cat) => {
            const items = byCat[cat.key] || [];
            if (!items.length) return null;
            return (
              <section key={cat.key} style={{ margin: '2.4rem 0' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{cat.title}</h2>
                <p style={{ color: 'var(--grey)', margin: '0 0 1.1rem', fontSize: '0.95rem' }}>{cat.hint}</p>
                <div style={{ display: 'grid', gap: '0.9rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                  {items.map((p) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      vuoto={cat.key === 'leccornie' ? 'Non dichiarati: chiedi allo staff' : undefined}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}

        {/* Download PDF ufficiale */}
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <a href={pdfUrl(doc)} target="_blank" rel="noopener noreferrer"
            className="btn btn-primary" style={{ display: 'inline-flex' }}>
            <Download size={18} /> Scarica il documento ufficiale (PDF)
          </a>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey)', marginTop: '1rem', maxWidth: 560, marginInline: 'auto' }}>
            In caso di allergie o intolleranze chiedi sempre conferma al nostro staff. Le informazioni sono indicative e
            vengono aggiornate periodicamente; fa fede il documento ufficiale.
          </p>
        </div>
      </main>
    </div>
  );
}
