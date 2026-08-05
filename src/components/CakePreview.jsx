import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useCakeData } from '../data/CakeDataProvider';
import { CRUMBLE_BASE_ID, isTallType } from '../data/cakeOptions';
import { messageFontStyle, DEFAULT_MESSAGE_FONT } from '../lib/messageFont';

// Three.js è pesante: lo carichiamo solo quando la torta 3D serve davvero.
const Cake3D = lazy(() => import('./Cake3D'));

// Coperture fatte di panna montata: panna LISCIA, spatolata. I ciuffi non
// fanno più parte della copertura, sono una decorazione a sé ('panna-deco' e
// 'panna-colorata'). ('meringa' è una copertura storica, ormai disattivata.)
const COPERTURE_PANNA = new Set(['panna', 'panna-sopra', 'panna-sotto-sopra', 'meringa']);

// Decorazioni fatte di panna: sono loro (e solo loro) a portare i ciuffi.
const DECORAZIONI_PANNA = new Set(['panna-deco', 'panna-colorata']);

// Decorazioni che NON si disegnano sulla torta: dipendono da cosa c'è in
// gelateria quel giorno e da come decide di decorare il gelataio. Disegnarle
// sarebbe una promessa (l'immagine finisce nell'ordine e il laboratorio si
// troverebbe vincolato), quindi si scrivono e basta, sopra la torta.
const DECORAZIONI_SU_DISPONIBILITA = new Set([
  'fantasia',
  'colorate',
  'cioccolato-deco',
  'cioccolato-fondente-deco',
]);

// Come si legge la copertura nella scheda. Per le coperture di panna il testo è
// scritto qui — dice dove va la panna e non promette ciuffi — mentre per tutte
// le altre si usa il nome del listino (che i titolari cambiano dalla dashboard).
const TESTO_COPERTURA = {
  panna: 'panna montata intorno, sopra e sui fianchi',
  'panna-sopra': 'panna montata solo sopra',
  'panna-sotto-sopra': 'panna montata sotto e sopra',
};

function descriviCopertura(covering) {
  if (!covering) return '';
  // Naked cake: non è una copertura, gli strati restano a vista.
  if (covering.id === 'naked') return 'a strati nudi, senza copertura';
  const testo = TESTO_COPERTURA[covering.id] || String(covering.name || '').toLowerCase();
  return testo ? `coperto da ${testo}` : '';
}

// Riga della panna decorativa: i ciuffi (e la panna colorata) arrivano SOLO
// dalla decorazione scelta, mai dalla copertura.
function descriviPannaDeco(decorationId, colore, coveringId) {
  if (!DECORAZIONI_PANNA.has(decorationId)) return '';
  if (decorationId === 'panna-deco') return 'con ciuffi di panna montata';
  const tinta = colore ? ` ${colore}` : '';
  return COPERTURE_PANNA.has(coveringId)
    ? `con la panna colorata${tinta} e ciuffi in tinta`
    : `con panna colorata${tinta} intorno e ciuffi in tinta`;
}

/* ===== decorazioni: una o più, ognuna col suo colore ===== */

/**
 * Decorazioni scelte, in forma pulita: lista di id (nell'ordine di scelta) e
 * mappa dei colori. Accetta anche il VECCHIO formato a decorazione singola
 * (`decoration` + `decorationColor`): arrivano ancora così gli ordini già
 * salvati e il link "Rifai questa torta" dei promemoria compleanno.
 */
function decorazioniScelte(config) {
  const colori = { ...(config.decorationColors || {}) };
  let lista = Array.isArray(config.decorations) ? config.decorations : [];
  if (!lista.length && config.decoration) {
    lista = [config.decoration];
    if (config.decorationColor) colori[config.decoration] = config.decorationColor;
  }
  const ids = [];
  for (const id of lista) {
    // 'nessuna' vuol dire "niente decorazioni": non è una decorazione da elencare
    if (!id || id === 'nessuna' || ids.includes(id)) continue;
    ids.push(id);
  }
  return { ids, colori };
}

// Accordo del colore col nome della decorazione ("fiocchi ROSSI", "panna
// ROSSA"): i titolari scrivono i colori un po' al maschile e un po' al
// femminile, qui si riportano alla forma giusta. Chi non è in tabella (blu,
// rosa, oro, argento, arcobaleno…) è invariabile e si scrive com'è.
const ROSSO = { ms: 'rosso', fs: 'rossa', mp: 'rossi', fp: 'rosse' };
const AZZURRO = { ms: 'azzurro', fs: 'azzurra', mp: 'azzurri', fp: 'azzurre' };
const NERO = { ms: 'nero', fs: 'nera', mp: 'neri', fp: 'nere' };
const GIALLO = { ms: 'giallo', fs: 'gialla', mp: 'gialli', fp: 'gialle' };
const BIANCO = { ms: 'bianco', fs: 'bianca', mp: 'bianchi', fp: 'bianche' };
const VERDE = { ms: 'verde', fs: 'verde', mp: 'verdi', fp: 'verdi' };
const COLORI_ACCORDO = {
  rosso: ROSSO, rossa: ROSSO,
  azzurro: AZZURRO, azzurra: AZZURRO,
  nero: NERO, nera: NERO,
  giallo: GIALLO, gialla: GIALLO,
  bianco: BIANCO, bianca: BIANCO,
  verde: VERDE,
};

// Genere e numero del NOME di ogni decorazione, per accordarci il colore.
// La chiave è l'id (stabile), non il nome: quello i titolari lo cambiano dalla
// dashboard. Chi non è in elenco vale maschile plurale, perché quasi tutte le
// decorazioni sono nomi plurali (macarons, spumini, fiori, fiocchi…).
const GENERE_DECORAZIONE = {
  perline: 'fp',
  colorate: 'fp',
  'panna-deco': 'fs',
  'panna-colorata': 'fs',
  'granella-nocciola': 'fs',
  'granella-pistacchio': 'fs',
  'frutta-fresca': 'fs',
  fantasia: 'fs',
};

/** Il colore scelto, accordato col nome della decorazione. */
function accordaColore(colore, genere = 'mp') {
  const key = String(colore || '').trim().toLowerCase();
  if (!key) return '';
  const forme = COLORI_ACCORDO[key];
  return forme ? forme[genere] || key : key;
}

/** Elenco all'italiana: "a", "a e b", "a, b e c". */
function elencoItaliano(voci) {
  if (voci.length < 2) return voci[0] || '';
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`;
}

/**
 * Riga di riepilogo delle decorazioni: le elenca tutte, ognuna col suo colore.
 * Es. "decorata con fiocchi colorati rossi e macarons verdi".
 * La panna non entra qui: ha una riga tutta sua (`descriviPannaDeco`), che
 * racconta anche dove va la panna spatolata.
 */
function descriviDecorazioni(decorazioni, colori) {
  const voci = decorazioni
    .filter((d) => !DECORAZIONI_PANNA.has(d.id) && !DECORAZIONI_SU_DISPONIBILITA.has(d.id))
    .map((d) => {
      const nome = String(d.name || '').trim().toLowerCase();
      if (!nome) return '';
      const colore = accordaColore(colori[d.id], GENERE_DECORAZIONE[d.id]);
      return colore ? `${nome} ${colore}` : nome;
    })
    .filter(Boolean);
  return voci.length ? `decorata con ${elencoItaliano(voci)}` : '';
}

/**
 * Anteprima visiva: SVG laterale con forma + strati colorati.
 * I colori degli strati corrispondono ai gusti scelti, le farciture
 * appaiono come linee tra gli strati, la copertura riveste l'esterno.
 */
export default function CakePreview({ config }) {
  const {
    shape = 'tonda',
    type,
    sizeId,
    flavors = [],
    baseId,
    crumbleId,
    fillingId = 'nessuna',
    coveringId = 'panna',
    message = '',
    candle = false,
    messageFont = DEFAULT_MESSAGE_FONT,
    photo = null,
    photoTransform = { zoom: 1, posX: 50, posY: 50 },
  } = config;

  const { cakeShapes, cakeTypes, cakeSizes, cakeBases, cakeCrumbles = [], cakeFillings, cakeCoverings, cakeDecorations } = useCakeData();

  const sh = cakeShapes.find((x) => x.id === shape) || cakeShapes[0];
  const t = cakeTypes.find((x) => x.id === type);
  const s = cakeSizes.find((x) => x.id === sizeId);

  // Forma del piatto: rettangolare per la rettangolare (e per 20+ persone),
  // quadrato per la quadrata, rotondo per tonda e cuore.
  const persone = s ? (parseInt(s.id, 10) || parseInt(String(s.label), 10) || 0) : 0;
  const plateShape =
    persone >= 20 ? 'rettangolare'
    : shape === 'quadrata' ? 'quadrata'
    : shape === 'rettangolare' ? 'rettangolare'
    : 'tonda';
  // Base: se è il crumble croccante e il cliente ha scelto il tipo, la torta 3D
  // e la scheda mostrano nome e colore di quel crumble (es. "crumble al cacao").
  const baseRow = cakeBases.find((x) => x.id === baseId);
  const crumble = baseId === CRUMBLE_BASE_ID ? cakeCrumbles.find((x) => x.id === crumbleId) : null;
  const b = baseRow && crumble
    ? { ...baseRow, name: crumble.name, color: crumble.color || baseRow.color }
    : baseRow;
  const filling = cakeFillings.find((x) => x.id === fillingId);
  const covering = cakeCoverings.find((x) => x.id === coveringId);
  // Le torte "Alte" devono vedersi davvero più alte nell'anteprima, non solo
  // nel nome: gli strati crescono in altezza (vedi `tall` in Cake3D).
  const tall = isTallType(type);

  // Decorazioni scelte: possono essere più d'una, ognuna col suo colore.
  // Gli id sconosciuti (listino cambiato, ordine vecchio) restano nella lista
  // per la torta 3D, ma nella scheda si elencano solo quelli che sappiamo dire.
  const { ids: decorationIds, colori: decorationColorMap } = decorazioniScelte(config);
  const decorazioni = decorationIds
    .map((id) => cakeDecorations.find((x) => x.id === id))
    .filter(Boolean);

  const rigaCopertura = descriviCopertura(covering);
  const rigaDecorazioni = descriviDecorazioni(decorazioni, decorationColorMap);
  // Le decorazioni che non si disegnano: si elencano sopra la torta, con la
  // precisazione che dipendono dalla gelateria. Non compaiono nella riga
  // "decorata con…", altrimenti sarebbero scritte due volte.
  const suDisponibilita = decorazioni
    .filter((d) => DECORAZIONI_SU_DISPONIBILITA.has(d.id))
    .map((d) => String(d.name || '').trim())
    .filter(Boolean);
  // La panna ha una riga sua: dice dove va la panna spatolata, non solo il colore.
  const righePanna = decorazioni
    .map((d) => descriviPannaDeco(d.id, accordaColore(decorationColorMap[d.id], 'fs'), covering?.id))
    .filter(Boolean);

  // Stile della scritta: gli id arrivano dalla tabella `scritte`, ma accettiamo
  // anche i vecchi (caveat/fraunces/inter) degli ordini e delle bozze salvate.
  const msgFont = messageFontStyle(messageFont);

  return (
    <motion.div
      className="cake-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="cake-card-ribbon">
        <span>Punto Gi!</span>
        <span className="dot" />
        <span>Pasticceria</span>
      </div>

      {/* Decorazioni che non si disegnano: scritte qui, sopra la torta, perché
          dipendono da cosa c'è in gelateria e dall'estro del gelataio. */}
      {suDisponibilita.length > 0 && (
        <div className="cake-card-nota">
          <strong>{elencoItaliano(suDisponibilita)}</strong>
          <span>secondo disponibilità in gelateria, a scelta del gelataio</span>
        </div>
      )}

      <div className="cake-card-body">
        {/* Renderer 3D reale (caricato in lazy).
            Decorazioni e colori viaggiano in coppia: `decorations` è la lista
            degli id scelti, nell'ordine (i ciuffi di panna arrivano solo da
            'panna-deco' e 'panna-colorata'), `decorationColors` dice con che
            colore per quelle che lo prevedono. Il nome del colore si passa così
            com'è scelto ("Azzurra"): la torta 3D lo traduce da sé, e regge anche
            un HEX o il valore mancante. */}
        <Suspense fallback={<div className="cake3d-stage cake3d-loading" aria-hidden="true" />}>
          <Cake3D
            shape={shape}
            plateShape={plateShape}
            tall={tall}
            flavors={flavors}
            base={b}
            filling={filling}
            covering={covering}
            candle={candle}
            photo={photo}
            photoTransform={photoTransform}
            decorations={decorationIds}
            decorationColors={decorationColorMap}
            message={message}
            messageFont={messageFont}
          />
        </Suspense>

        <h3 className="cake-card-type">{t?.name || 'La tua torta'}</h3>

        {(s || sh) && (
          <p className="cake-card-size">
            {sh?.name}{s ? ` · Ø ${s.diameter} cm · ${s.label.toLowerCase()}` : ''}
          </p>
        )}

        {flavors.length > 0 && (
          <div className="cake-card-flavors">
            <span className="cake-card-label">Strati</span>
            <div className="flavor-chips">
              {flavors.map((f, i) => (
                <span key={i} className="flavor-chip">
                  <span className="flavor-chip-dot" style={{ background: f.color }} />
                  {f.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {filling && filling.id !== 'nessuna' && (
          <p className="cake-card-base">
            <em>farcito con {filling.name.toLowerCase()}</em>
          </p>
        )}

        {rigaCopertura && (
          <p className="cake-card-base">
            <em>{rigaCopertura}</em>
          </p>
        )}

        {rigaDecorazioni && (
          <p className="cake-card-base">
            <em>{rigaDecorazioni}</em>
          </p>
        )}


        {righePanna.map((riga) => (
          <p className="cake-card-base" key={riga}>
            <em>{riga}</em>
          </p>
        ))}

        {b && (
          <p className="cake-card-base">
            <em>su base {b.name.toLowerCase()}</em>
          </p>
        )}

        {message && (
          <div className="cake-card-message">
            <span className="cake-card-label">Scritta</span>
            <p
              style={{
                fontFamily: msgFont.family,
                fontStyle: msgFont.italic ? 'italic' : 'normal',
                fontWeight: msgFont.weight,
                textTransform: msgFont.uppercase ? 'uppercase' : 'none',
                letterSpacing: msgFont.letterSpacing,
              }}
            >
              "{message}"
            </p>
          </div>
        )}

        <div className="cake-card-icons">
          {decorazioni.map((d) => {
            const colore = String(decorationColorMap[d.id] || '').trim().toLowerCase();
            return (
              <span className="cake-card-icon" key={d.id}>
                <span aria-hidden="true">{d.emoji}</span>
                {d.name}
                {colore ? ` · ${colore}` : ''}
              </span>
            );
          })}
          {candle && (
            <span className="cake-card-icon">
              <span aria-hidden="true">🕯️</span>
              candelina
            </span>
          )}
          {photo && (
            <span className="cake-card-icon">
              <span aria-hidden="true">📸</span>
              foto su cialda
            </span>
          )}
        </div>
      </div>

      <div className="cake-card-footer">
        <span>fatta a mano · ingredienti freschi</span>
      </div>

    </motion.div>
  );
}

/* ===== SVG renderer laterale ===== */
function CakeSvg({ shape, flavors, base, filling, covering, candle, photo, decorationEmoji }) {
  const W = 400;
  const H = 380;
  const cx = W / 2;
  const baseY = 300; // base della torta (dove poggia sul vassoio)

  // Numero strati in base ai gusti scelti (min 1)
  const layers = Math.max(1, flavors.length);
  const layerH = layers > 3 ? 38 : layers > 2 ? 46 : 56;
  const totalCakeH = layers * layerH;
  const cakeTopY = baseY - totalCakeH;

  // Larghezza in base alla forma (vista 3/4)
  const widthByShape = {
    tonda: 240,
    cuore: 230,
    quadrata: 250,
    rettangolare: 300,
  };
  const cakeW = widthByShape[shape] || 240;
  const halfW = cakeW / 2;

  const isCircular = shape === 'tonda' || shape === 'cuore';
  // ry per ellissi (prospettiva 3/4 più marcata)
  const topRy = isCircular ? halfW * 0.32 : halfW * 0.26;

  const coverColor = covering?.color || '#fff8e6';
  const coverIsNaked = covering?.id === 'naked';
  const baseColor = base?.color || '#e8d2a8';
  const fillingColor = filling?.color;

  // Vassoio viola Punto Gi! (più largo e prominente)
  const platterRx = halfW + 55;
  const platterRy = topRy + 24;
  const platterCy = baseY + 14;
  const platterDepth = 14;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      className="cake-svg cake-svg-spin"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="platterViolet" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#8b3fc4" />
          <stop offset="55%" stopColor="#602e9e" />
          <stop offset="100%" stopColor="#3d1c66" />
        </radialGradient>
        <linearGradient id="platterRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
        </linearGradient>
        <radialGradient id="platterShine" cx="35%" cy="35%" r="40%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="sideShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="40%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </linearGradient>
      </defs>

      {/* Ombra a terra (più morbida e diffusa) */}
      <ellipse
        cx={cx}
        cy={baseY + 50}
        rx={platterRx + 18}
        ry={platterRy * 0.55}
        fill="rgba(60,20,100,0.28)"
        filter="blur(4px)"
      />

      {/* Vassoio viola — lato/profondità */}
      <path
        d={`M ${cx - platterRx} ${platterCy}
            v ${platterDepth}
            a ${platterRx} ${platterRy} 0 0 0 ${platterRx * 2} 0
            v ${-platterDepth} z`}
        fill="url(#platterRim)"
      />
      {/* Bordo inferiore scuro del vassoio */}
      <ellipse
        cx={cx}
        cy={platterCy + platterDepth}
        rx={platterRx}
        ry={platterRy}
        fill="#2a0f4a"
      />
      {/* Vassoio viola — top */}
      <ellipse cx={cx} cy={platterCy} rx={platterRx} ry={platterRy} fill="url(#platterViolet)" />
      {/* Riflesso lucido sul vassoio */}
      <ellipse
        cx={cx - platterRx * 0.3}
        cy={platterCy - platterRy * 0.35}
        rx={platterRx * 0.6}
        ry={platterRy * 0.45}
        fill="url(#platterShine)"
        opacity={0.85}
      />
      {/* Doppio bordo dorato decorativo del vassoio */}
      <ellipse
        cx={cx}
        cy={platterCy}
        rx={platterRx - 5}
        ry={platterRy - 3}
        fill="none"
        stroke="rgba(245,210,140,0.55)"
        strokeWidth={1.2}
      />
      <ellipse
        cx={cx}
        cy={platterCy}
        rx={platterRx - 12}
        ry={platterRy - 7}
        fill="none"
        stroke="rgba(245,210,140,0.25)"
        strokeWidth={0.7}
      />

      {/* GRUPPO TORTA: ruota sull'asse verticale (Y) tramite CSS */}
      <g className="cake-rotate" style={{ transformOrigin: `${cx}px ${baseY}px` }}>
        {/* Strati (dal basso verso l'alto): ogni strato = lato (rect) + top (ellisse) */}
        {Array.from({ length: layers }).map((_, i) => {
          const flavor = flavors[i] || flavors[flavors.length - 1] || { color: '#fff8e6' };
          const yTop = baseY - (i + 1) * layerH;
          const yBottom = yTop + layerH;
          const isTopLayer = i === layers - 1;

          // Costruisci il lato cilindrico come path: due ellissi (top e bottom) collegate
          const sidePath = `
            M ${cx - halfW} ${yTop}
            v ${layerH}
            a ${halfW} ${topRy} 0 0 0 ${cakeW} 0
            v ${-layerH}
          `;

          return (
            <g key={i}>
              {/* Lato dello strato */}
              <path d={sidePath} fill={flavor.color} />
              {/* Gradiente di luce sul lato (più chiaro a sx, più scuro a dx) */}
              <path
                d={sidePath}
                fill="url(#sideShade)"
                opacity={0.5}
              />
              {/* Disco superiore dello strato (visibile solo se non è coperto sopra) */}
              {(coverIsNaked || isTopLayer) && (
                <ellipse
                  cx={cx}
                  cy={yTop}
                  rx={halfW}
                  ry={topRy}
                  fill={flavor.color}
                />
              )}
              {/* Bordo "morso" leggero sul disco */}
              {(coverIsNaked || isTopLayer) && (
                <ellipse
                  cx={cx}
                  cy={yTop}
                  rx={halfW}
                  ry={topRy}
                  fill="none"
                  stroke={shadeColor(flavor.color, -0.18)}
                  strokeWidth={0.6}
                />
              )}

              {/* Farcitura tra strati: linea ondulata sopra al disco di ogni strato (tranne l'ultimo) */}
              {fillingColor && !isTopLayer && (
                <g>
                  <path
                    d={`M ${cx - halfW} ${yTop}
                        a ${halfW} ${topRy} 0 0 0 ${cakeW} 0`}
                    fill="none"
                    stroke={fillingColor}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          );
        })}

        {/* Base biscotto sotto (sottile) */}
        <g>
          <path
            d={`M ${cx - halfW} ${baseY}
                v 6
                a ${halfW} ${topRy * 0.9} 0 0 0 ${cakeW} 0
                v -6`}
            fill={baseColor}
          />
          <ellipse cx={cx} cy={baseY} rx={halfW} ry={topRy} fill={baseColor} opacity={0.001} />
        </g>

        {/* Copertura esterna (solo se non naked): avvolge i lati e la calotta */}
        {!coverIsNaked && (
          <g>
            {/* Lato della copertura */}
            <path
              d={`M ${cx - halfW - 1} ${cakeTopY}
                  v ${totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 0 ${cakeW + 2} 0
                  v ${-totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 1 ${-(cakeW + 2)} 0`}
              fill={coverColor}
              stroke={shadeColor(coverColor, -0.15)}
              strokeWidth={0.5}
            />
            {/* Ombreggiatura lato (per dare volume) */}
            <path
              d={`M ${cx} ${cakeTopY}
                  v ${totalCakeH}
                  a ${halfW + 1} ${topRy * 1.05} 0 0 0 ${halfW + 1} ${-topRy * 1.05}
                  v ${-totalCakeH}`}
              fill="rgba(0,0,0,0.12)"
            />
            {/* Calotta superiore */}
            <ellipse
              cx={cx}
              cy={cakeTopY}
              rx={halfW + 1}
              ry={topRy * 1.05}
              fill={coverColor}
            />
            {/* Riflesso lucido sulla calotta (inclinato a sinistra) */}
            <ellipse
              cx={cx - halfW * 0.35}
              cy={cakeTopY - topRy * 0.25}
              rx={halfW * 0.45}
              ry={topRy * 0.35}
              fill="rgba(255,255,255,0.45)"
            />

            {/* Gocce/colature laterali per glasse liquide */}
            {(covering?.id === 'glassa-specchio' ||
              covering?.id === 'ganache-cop' ||
              covering?.id === 'cioccolato-cop' ||
              covering?.id === 'cioccolato-bianco-cop' ||
              covering?.id === 'nocciola-cop' ||
              covering?.id === 'pistacchio-cop') && (
              <g>
                {[0.12, 0.32, 0.52, 0.72, 0.88].map((p, i) => {
                  const angle = Math.PI * p; // mezzo cerchio frontale
                  const dx = -Math.cos(angle) * halfW;
                  const dy = Math.sin(angle) * topRy * 1.05;
                  const dh = 10 + ((i * 11) % 18);
                  return (
                    <path
                      key={i}
                      d={`M ${cx + dx - 4} ${cakeTopY + dy}
                          q 4 ${dh / 2} 8 0
                          v ${dh}
                          q -4 4 -8 0 z`}
                      fill={coverColor}
                      stroke={shadeColor(coverColor, -0.15)}
                      strokeWidth={0.4}
                    />
                  );
                })}
              </g>
            )}
          </g>
        )}

        {/* Pattern naked: contorni sottili per definire i singoli strati */}
        {coverIsNaked &&
          Array.from({ length: layers }).map((_, i) => {
            const yTop = baseY - (i + 1) * layerH;
            return (
              <ellipse
                key={`nk-${i}`}
                cx={cx}
                cy={yTop}
                rx={halfW}
                ry={topRy}
                fill="none"
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={0.6}
              />
            );
          })}

        {/* Foto cialda sopra (cerchio prospettico) */}
        {photo && (
          <g>
            <defs>
              <clipPath id="photoClipTop">
                <ellipse cx={cx} cy={cakeTopY - 2} rx={halfW * 0.55} ry={topRy * 0.55} />
              </clipPath>
            </defs>
            <ellipse
              cx={cx}
              cy={cakeTopY - 2}
              rx={halfW * 0.6}
              ry={topRy * 0.6}
              fill="#d4b07a"
            />
            <image
              href={photo}
              x={cx - halfW * 0.55}
              y={cakeTopY - 2 - topRy * 0.55}
              width={halfW * 1.1}
              height={topRy * 1.1}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#photoClipTop)"
            />
          </g>
        )}

        {/* Decorazioni sopra: 5 emoji disposte in cerchio (prospettico) sulla calotta */}
        {decorationEmoji && (
          <g fontSize="14" textAnchor="middle">
            {Array.from({ length: 5 }).map((_, i) => {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              const dx = Math.cos(a) * halfW * 0.55;
              const dy = Math.sin(a) * topRy * 0.55;
              return (
                <text key={i} x={cx + dx} y={cakeTopY - 2 + dy + 4}>
                  {decorationEmoji}
                </text>
              );
            })}
          </g>
        )}

        {/* Candelina (sull'asse centrale, leggermente avanti) */}
        {candle && (
          <g>
            <rect
              x={cx - 2}
              y={cakeTopY - 32}
              width={4}
              height={28}
              fill="#fff"
              stroke="#d8a8c8"
              strokeWidth={0.5}
              rx={1}
            />
            {/* Bandelle decorative sulla candela */}
            <rect x={cx - 2} y={cakeTopY - 24} width={4} height={2} fill="#b651e4" />
            <rect x={cx - 2} y={cakeTopY - 16} width={4} height={2} fill="#eb911e" />
            <line x1={cx} y1={cakeTopY - 32} x2={cx} y2={cakeTopY - 36} stroke="#3a2418" strokeWidth={1} />
            <ellipse cx={cx} cy={cakeTopY - 39} rx={3} ry={5} fill="#fff200" />
            <ellipse cx={cx} cy={cakeTopY - 39} rx={1.8} ry={3} fill="#eb911e" />
          </g>
        )}
      </g>

    </svg>
  );
}

/* Helper: schiarisce/scurisce un colore HEX di una percentuale (-1..1) */
function shadeColor(hex, amount) {
  const m = (hex || '#888888').replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  const apply = (v) =>
    Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(apply(r))}${toHex(apply(g))}${toHex(apply(b))}`;
}
