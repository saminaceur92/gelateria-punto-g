# Product

<!-- impeccable:product-schema 1 -->

> Nota: PRODUCT.md compilato in sessione non presidiata su delega esplicita dell'utente
> ("fai del tuo meglio"). I fatti sono estratti dal repo e dal sito live; le voci
> marcate *(dedotto)* sono inferenze non confermate.

## Platform

web

## Users

Clienti della gelateria a Carpi (MO) e dintorni: famiglie, coppie, giovani del
posto. Due lavori principali: (1) decidere se passare in negozio — gusti del
giorno, orari, dove si trova; (2) ordinare una torta personalizzata per un
compleanno o una ricorrenza. Pubblico rilevante con esigenze alimentari:
intolleranti al lattosio, celiaci, vegani (il sito ha una pagina Allergeni
dedicata e QR in negozio). Uso prevalentemente da smartphone *(dedotto dai QR
in negozio e dal traffico tipico locale)*.

## Product Purpose

Sito ufficiale della Gelateria Punto Gi! di Carpi. Vetrina emozionale del
prodotto (gelato artigianale, torte, pasticceria a freddo), informazioni
pratiche sempre aggiornate (menù live, orari, contatti, allergeni) e canale di
conversione: configuratore di torte 3D con pagamento Stripe e contatto diretto
WhatsApp. Successo = visite in negozio e torte prenotate.

## Positioning

"Il gelato che ti emoziona." Ricetta propria perfezionata negli anni: gelato
cremoso, corposo, denso "come quello di una volta", fresco ogni giorno, con
gamma senza lattosio / senza glutine / vegan. Differenziatori che un vicino non
può copiare: il gusto firma "Punto Gi", la trasparenza allergeni (Quaderno
Allergeni + QR), il configuratore di torte passo-passo con anteprima 3D e
pagamento online, i numeri reali di produzione (12.000+ kg di gelato e 2.000+
torte l'anno, 365 giorni di produzione).

## Operating Context

- Negozio fisico in Via Remesina Interna 46, 41012 Carpi (MO); WhatsApp
  320 330 6009; Instagram @gelateriapuntogicarpi; Facebook.
- Menù e orari gestiti dallo staff: dati da Airtable in fase di build
  (`scripts/build-data.mjs` → `src/data/generated/`) con aggiornamento live da
  Supabase e fallback statico. **Vincolo: non rimuovere il data-layer Airtable
  finché il branch Supabase parallelo non è mergiato.**
- Torte: prenotazione con minimo 5 ore, configuratore (tipo, dimensione, gusti,
  decorazione, scritta, candelina), esito pagamento Stripe via query param,
  promemoria compleanno via token (`?torta=`, `?stop=`).
- Routing per pathname in `src/main.jsx`: `/admin` e `/allergeni` lazy;
  il resto renderizza `App`.

## Capabilities and Constraints

- Stack: Vite 5 + React 18 SPA, framer-motion, lucide-react, three.js
  (anteprima torta), deploy Vercel. CSS globale artigianale in
  `src/styles/global.css` (nessun framework CSS).
- Asset reali: logo `public/logo.png`, favicon, foto piatti
  (`hero-cup.jpg`, `gelato.jpg`, `torte.jpg`, `semifreddi.jpg`,
  `pasticcini.jpg`), 50 foto gallery ottimizzate in `public/gallery/`.
- Catalogo gusti reale (da brochure ufficiale): Creme (22), Frutta & Veggy (6,
  naturalmente vegan), Semifreddi, Altre Leccornie; tag "firma" e diete per
  gusto. Orari reali in `src/data/`.
- Il configuratore torte (`CakeConfigurator` + `CakeDataProvider`) è
  funzionante e riusabile da qualsiasi pagina.
- Fase 2 in roadmap (non ancora vera): e-commerce completo, GDPR, notifiche.
  Non inventare claim su questi punti.

## Brand Commitments

- Nome: **Punto Gi!** (con esclamativa; "Punto G" solo nel nome cartella).
  Payoff: "Il gelato che ti emoziona".
- Logo esistente (`/logo.png`), tono di voce caldo, giocoso, italiano,
  con note scritte a mano ("a prestissssimo!", "Ti aspettiamo per farti
  emozionare!").
- **Palette vincolante (confermata dall'utente, 2026-08-09): i colori scelti
  dai proprietari sono l'azzurro e il marroncino/legno del negozio fisico —
  azzurro `#7cb7d7`/`#2c7699`, legno/caramello `#c0894c`, panna `#fbf6ec`,
  testa di moro `#32281f`. Il viola della vecchia palette Canva NON si usa
  più come colore di brand.** La palette Canva (viola `#b651e4`/`#602e9e`,
  arancio `#eb911e`) resta solo come documento storico nel README.
- Il gusto firma "Punto Gi" mantiene il SUO colore viola `#b651e4` come colore
  del gusto nel catalogo (dato di prodotto, non colore di brand).

## Evidence on Hand

- Copy reale del sito v1 (hero, storia, servizi, numeri, contatti) nei
  componenti `src/components/*`.
- Numeri di produzione: +12.000 kg gelato/anno, +2.000 torte/anno, 365
  giorni/anno, torte sfornate fresche ogni giorno.
- Quaderno Allergeni (PDF caricabile, pagina `/allergeni` con QR).
- Nessuna testimonianza cliente / recensione raccolta nel repo: non inventarle.

## Product Principles

1. Emozione prima di tutto: il sito deve far venire voglia di gelato, non
   descriverlo.
2. Inclusione alimentare come orgoglio, non come nota a piè di pagina
   (senza lattosio / gluten-free / vegan sempre visibili).
3. Informazioni pratiche sempre vere: menù, orari e allergeni arrivano dai
   dati gestiti dallo staff, mai hardcodati in copy.
4. Mobile prima: la maggior parte dei visitatori arriva da smartphone; la
   qualità si verifica con screenshot reali su viewport mobile.
5. Conversione gentile: WhatsApp e configuratore torte sempre a portata,
   senza aggressività da e-commerce.

## Accessibility & Inclusion

Contrasto WCAG AA sui testi, `prefers-reduced-motion` rispettato (già prassi
nel codice v1 con i contatori), target touch ≥ 44px, informazioni allergeni
raggiungibili da ogni pagina.
