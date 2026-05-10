import { motion } from 'framer-motion';
import { cakeTypes, cakeSizes, cakeBases, cakeDecorations } from '../data/cakeOptions';

/**
 * Anteprima editoriale (no rendering 3D): card stile "menu di pasticceria"
 * che riepiloga in modo elegante la configurazione corrente.
 */
export default function CakePreview({ config }) {
  const {
    type,
    sizeId,
    flavors = [],
    baseId,
    decoration,
    message = '',
    candle = false,
    messageFont = 'caveat',
    photo = null,
  } = config;

  const t = cakeTypes.find((x) => x.id === type);
  const s = cakeSizes.find((x) => x.id === sizeId);
  const b = cakeBases.find((x) => x.id === baseId);
  const d = cakeDecorations.find((x) => x.id === decoration);

  const fontFamily =
    messageFont === 'fraunces'
      ? "'Fraunces', serif"
      : messageFont === 'inter'
      ? "'Inter', sans-serif"
      : "'Caveat', cursive";
  const fontStyle = messageFont === 'fraunces' ? 'italic' : 'normal';
  const fontWeight = messageFont === 'inter' ? 800 : messageFont === 'caveat' ? 700 : 600;
  const fontTransform = messageFont === 'inter' ? 'uppercase' : 'none';
  const fontLetter = messageFont === 'inter' ? '0.06em' : 'normal';

  return (
    <motion.div
      className="cake-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      key={`${type}-${sizeId}-${flavors.length}-${decoration}-${baseId}-${candle}-${photo ? 'p' : 'n'}`}
    >
      <div className="cake-card-ribbon">
        <span>Punto G!</span>
        <span className="dot" />
        <span>Pasticceria</span>
      </div>

      <div className="cake-card-body">
        {photo && (
          <div className="cake-card-photo">
            <img src={photo} alt="Foto torta" />
            <span className="cake-card-photo-tag">su cialda</span>
          </div>
        )}

        <h3 className="cake-card-type">{t?.name || 'La tua torta'}</h3>

        {s && (
          <p className="cake-card-size">
            Ø {s.diameter} cm · {s.label.toLowerCase()}
          </p>
        )}

        {flavors.length > 0 && (
          <div className="cake-card-flavors">
            <span className="cake-card-label">Gusti</span>
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
                fontFamily,
                fontStyle,
                fontWeight,
                textTransform: fontTransform,
                letterSpacing: fontLetter,
              }}
            >
              "{message}"
            </p>
          </div>
        )}

        <div className="cake-card-icons">
          {d && (
            <span className="cake-card-icon">
              <span aria-hidden="true">{d.emoji}</span>
              {d.name}
            </span>
          )}
          {candle && (
            <span className="cake-card-icon">
              <span aria-hidden="true">🕯️</span>
              candelina
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
