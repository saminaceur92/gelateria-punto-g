const items = [
  'Artigianale',
  'Senza lattosio',
  'Vegan friendly',
  'Fresco ogni giorno',
  'Made in Carpi',
  'Torte su misura',
  'Granite siciliane',
  'Pasticceria a freddo',
];

export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <span>
          {[...items, ...items].map((it, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '3rem' }}>
              {it}
              <span className="dot" />
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
