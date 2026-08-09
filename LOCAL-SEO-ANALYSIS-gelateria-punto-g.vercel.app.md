# Local SEO Analysis — gelateria-punto-g.vercel.app

**Data analisi:** agosto 2026
**Business:** Gelateria Punto Gi! — Via Remesina Interna 46, 41012 Carpi (MO)
**Ragione sociale (da PagineGialle):** Gelateria Punto Gi di Bulgarelli Cristian & C. s.n.c.

---

## 1. Local SEO Score: 38/100

| Dimensione | Peso | Punteggio | Stato |
|---|---|---|---|
| GBP Signals | 25% | 12/25 | 🟡 Parziale |
| Reviews & Reputation | 20% | 4/20 | 🔴 Basso |
| Local On-Page SEO | 20% | 10/20 | 🟡 Parziale |
| NAP & Citations | 15% | 8/15 | 🟡 Parziale |
| Local Schema | 10% | 0/10 | 🔴 Assente |
| Local Links & Authority | 10% | 4/10 | 🔴 Basso |
| **TOTALE** | | **38/100** | |

Il sito è ben fatto lato UX ma **quasi invisibile ai segnali che contano per il local pack**. Il punteggio basso non riflette la qualità del sito: riflette che mancano gli elementi strutturali che Google e le AI usano per capire *cos'è* e *dov'è* questa attività.

---

## 2. Business type

**Brick-and-mortar** — indirizzo fisico visibile, embed Google Maps con indirizzo, orari di apertura, nessun linguaggio da service-area. (La consegna a domicilio è un servizio aggiuntivo, non cambia la classificazione.)

---

## 3. Vertical: Food & Beverage — Gelateria

Segnali rilevati: carta dei gusti, torte su ordinazione, pagina allergeni Reg. UE 1169/2011, pasticceria a freddo, orari di apertura.

**Subtipo schema corretto:** `IceCreamShop` (sottotipo di `FoodEstablishment`) — **non** il generico `LocalBusiness`.

---

## 4. GBP optimization checklist

| Elemento | Stato |
|---|---|
| Embed Google Maps | ✅ presente (`google.com/maps?q=Via+Remesina+Interna+46,+Carpi+MO`) |
| Embed con **Place ID** | ❌ usa la query per indirizzo, non il place ID → segnale più debole |
| Orari visibili sul sito | ✅ presenti (da Supabase, 7 giorni) |
| Recensioni Google sul sito | ❌ assenti |
| Foto/gallery | ✅ 50 foto in gallery |
| Link a profilo GBP | ❌ assente |
| Categoria primaria | ⚠️ non verificabile dal sito — **da controllare su GBP: deve essere "Gelateria"** |

> ⚠️ **Non verificabile da qui:** stato del profilo GBP (rivendicato/verificato), categoria primaria e secondarie, post, Q&A, foto caricate. Va controllato direttamente su business.google.com.

---

## 5. Review health snapshot

**Sul sito: zero.** Nessuna recensione, nessun rating, nessun `aggregateRating` in schema, nessun link a piattaforme di recensioni.

**Fuori dal sito (rilevate):**
- **Facebook**: 98% consigliato su 37 recensioni ✅ ottimo
- **TripAdvisor**: presente (2 schede — vedi problema duplicati)
- **Sluurpy**: presente (2 schede)
- **abillion**, **Wanderlog** ("30 best desserts in Carpi") ✅

**Il problema:** avete recensioni ottime che il sito non sfrutta in alcun modo. È valore già guadagnato e buttato via.

---

## 6. NAP consistency audit

| Fonte | Nome | Indirizzo | Telefono |
|---|---|---|---|
| Footer sito | Gelateria Punto Gi! | Via Remesina Interna 46, 41012 Carpi (MO) | 320 330 6009 |
| Sezione Contatti | Gelateria Punto Gi! | Via Remesina Interna 46, 41012 Carpi (MO) | 320 330 6009 |
| Schema JSON-LD | ❌ **assente** | ❌ assente | ❌ assente |
| PagineGialle | Gelateria Punto Gi di Bulgarelli Cristian & C. s.n.c. | Via Remesina 46 | 320 3306009 |

✅ NAP **coerente** tra footer e contatti del sito.
❌ NAP **non presente in nessuno schema strutturato**.
⚠️ Variante indirizzo: il sito dice "Via Remesina **Interna** 46", PagineGialle "Via Remesina 46" → da uniformare.

### 🔴 PROBLEMA CRITICO: schede duplicate

Esistono **due attività separate** sulle directory, per il vecchio e il nuovo nome:

| Piattaforma | Scheda A | Scheda B |
|---|---|---|
| TripAdvisor | Gelateria Punto **Gi** (d7600098) | Gelateria Punto **G** (d4136858) |
| Sluurpy | Punto Gi (130839) | Punto G (129423) |

Questo **spacca le recensioni su due schede**, confonde Google sull'identità dell'attività e indebolisce entrambe. È il problema NAP più grave rilevato.

---

## 7. Citation presence check

| Directory | Stato | Priorità |
|---|---|---|
| Google Business Profile | ⚠️ da verificare | 🔴 Critica |
| PagineGialle | ✅ presente | — |
| TripAdvisor | ⚠️ presente ma **duplicata** | 🔴 Alta |
| Facebook | ✅ presente (98%, 37 rec.) | — |
| Sluurpy | ⚠️ presente ma **duplicata** | 🟡 Media |
| Italia.it | ✅ presente | — |
| Wanderlog ("best desserts in Carpi") | ✅ presente | ⭐ ottimo per AI |
| **Bing Places** | ❌ assente | 🔴 Alta — alimenta **ChatGPT**, Copilot, Alexa |
| **Apple Maps** | ❌ da verificare | 🟡 Media |
| TheFork / Yelp Italia | ❌ assente | 🟢 Bassa |

---

## 8. Local schema status

### 🔴 ASSENTE — zero blocchi JSON-LD sul sito (verificato su HTML grezzo e renderizzato)

È la mancanza singola più impattante: senza schema, Google e le AI devono *indovinare* indirizzo, orari e tipo di attività leggendo il testo. Con lo schema glielo dici in modo esplicito e machine-readable.

### Schema pronto da incollare in `index.html`

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "IceCreamShop",
  "@id": "https://gelateria-punto-g.vercel.app/#business",
  "name": "Gelateria Punto Gi!",
  "legalName": "Gelateria Punto Gi di Bulgarelli Cristian & C. s.n.c.",
  "description": "Gelateria artigianale a Carpi (MO). Gelato cremoso prodotto fresco ogni giorno, anche senza lattosio e vegan. Torte gelato su ordinazione, semifreddi e pasticceria a freddo.",
  "url": "https://gelateria-punto-g.vercel.app",
  "telephone": "+393203306009",
  "image": "https://gelateria-punto-g.vercel.app/gelato.jpg",
  "logo": "https://gelateria-punto-g.vercel.app/logo.png",
  "priceRange": "€",
  "currenciesAccepted": "EUR",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Via Remesina Interna 46",
    "addressLocality": "Carpi",
    "addressRegion": "MO",
    "postalCode": "41012",
    "addressCountry": "IT"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "DA_COMPILARE",
    "longitude": "DA_COMPILARE"
  },
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      "opens": "11:00", "closes": "23:00" }
  ],
  "servesCuisine": "Gelato artigianale",
  "hasMenu": "https://gelateria-punto-g.vercel.app/#menu",
  "areaServed": [
    { "@type": "City", "name": "Carpi" },
    { "@type": "City", "name": "Soliera" },
    { "@type": "City", "name": "Novi di Modena" },
    { "@type": "City", "name": "San Possidonio" }
  ],
  "sameAs": [
    "https://www.facebook.com/gelateriapuntogicarpi",
    "https://www.instagram.com/gelateriapuntogicarpi/"
  ]
}
</script>
```

> ⚠️ **`latitude`/`longitude` vanno compilate con le coordinate reali** (minimo 5 decimali). Si prendono da Google Maps: tasto destro sul punto esatto del negozio → clic sulle coordinate per copiarle. **Non inventarle**: coordinate sbagliate sono peggio di assenti.
>
> ⚠️ Gli **orari nello schema vanno allineati a quelli veri**: quelli attualmente sul sito (11:00–23:00 tutti i giorni, lunedì incluso) sembrano un placeholder e non coincidono con la versione precedente (lunedì chiuso, apertura 15:00). **Da confermare col negozio.**

### `aggregateRating` — da aggiungere solo se veritiero

Ha senso aggiungerlo **solo** con dati reali e verificabili, altrimenti è una violazione delle linee guida Google:

```json
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.8",
  "reviewCount": "37",
  "bestRating": "5"
}
```

---

## 9. Location page quality

**N/A** — attività a sede singola, nessuna location page. Nessun rischio doorway page. ✅

---

## 10. Top 10 azioni prioritizzate

### 🔴 CRITICHE

**1. Aggiungere lo schema `IceCreamShop`** (30 min)
- *Osservazione:* zero JSON-LD sul sito; Google deve indovinare tutto.
- *Sblocca:* rich result, comprensione AI, eleggibilità local pack.
- *Come sapere se ha funzionato:* Rich Results Test di Google mostra l'entità senza errori.
- *Indicatore da monitorare:* impression "Gelateria Carpi" in Search Console.

**2. Unificare le schede duplicate Punto G / Punto Gi** (1–2 h, azione del titolare)
- *Osservazione:* due schede su TripAdvisor e Sluurpy spaccano recensioni e identità.
- *Sblocca:* consolidamento review signals (20% del peso local).
- *Come:* su TripAdvisor "Segnala duplicato" dalla scheda vecchia; su Sluurpy contattare l'assistenza.
- *Fallisce se:* dopo 30 giorni entrambe le schede sono ancora attive → serve escalation.

**3. Verificare il Google Business Profile** (30 min, titolare)
- *Osservazione:* non verificabile dal sito, ma vale il 25% del punteggio local e la categoria primaria è il fattore #1 in assoluto.
- *Check:* profilo rivendicato? Categoria primaria **"Gelateria"**? Orari giusti? Foto recenti?

### 🟠 ALTE

**4. Rendere il contenuto visibile senza JavaScript** (2–4 h)
- *Osservazione:* l'HTML grezzo è `<div id="root"></div>` vuoto. Indirizzo, orari, gusti **non esistono** finché non gira il JS. Google renderizza, ma **molti crawler AI no**.
- *Sblocca:* citabilità AI (ChatGPT/Perplexity), robustezza indicizzazione.
- *Come:* prerender della home (`vite-plugin-prerender` o simile), oppure — minimo indispensabile — NAP e orari in `index.html` dentro un `<noscript>` + lo schema JSON-LD (che è statico e risolve già gran parte del problema).

**5. Aggiungere `robots.txt` e `sitemap.xml`** (20 min) — entrambi **404** adesso.

**6. H1 con intento locale** (10 min)
- *Attuale:* "Il gelato che ti emoziona." → zero segnale locale.
- *Proposta:* mantenere l'impatto ma aggiungere contesto, es. sottotitolo H2 "Gelateria artigianale a Carpi (MO)". Il claim resta, il segnale locale c'è.

**7. Portare le recensioni sul sito** (1–2 h)
- Avete **98% su 37 recensioni Facebook** e non si vedono da nessuna parte. Aggiungere una sezione recensioni + `aggregateRating` reale.

### 🟡 MEDIE

**8. Aprire Bing Places** (30 min, gratis) — alimenta **ChatGPT**, Copilot e Alexa. Con il 45% degli utenti che ormai chiede consigli locali all'AI, questo canale conta più di quanto sembri.

**9. Dominio proprio** (~10 €/anno) — `gelateriapuntogi.it` invece di `.vercel.app`. Un sottodominio di piattaforma è un segnale di autorità debole e non è brandizzabile.

**10. Completare i meta social** (15 min) — mancano `og:image`, `og:url`, `canonical`. Ora se condividono il link su WhatsApp/Facebook non esce nessuna immagine.

### 🟢 BASSE

- `llms.txt` (mezz'ora) — non serve per le citazioni ChatGPT ma è lo standard emergente per gli agent.
- Apple Maps / Apple Business — da rivendicare.
- Uniformare "Via Remesina Interna 46" vs "Via Remesina 46" su tutte le directory.

---

## 11. Limitazioni di questa analisi

Cosa **non** è stato possibile valutare dall'esterno:

- **Stato reale del GBP**: rivendicato/verificato, categoria primaria e secondarie, post, Q&A, foto, GBP Insights → serve accesso al profilo
- **Posizione nel local pack** e geo-grid ranking (SoLV) → serve DataForSEO o strumenti a pagamento
- **Domain Authority e profilo backlink completo** → serve Moz/Ahrefs/DataForSEO
- **Volume di ricerca reale** per "gelateria Carpi" e affini → serve Keyword Planner o DataForSEO
- **Velocità recensioni** (regola dei 18 giorni) → serve monitoraggio continuo
- **Dati di campo Core Web Vitals** → serve Search Console / CrUX (`/seo google`)

Per colmarli: `/seo maps` (con estensione DataForSEO), `/seo google` (con credenziali Search Console), `/seo backlinks`.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Built by agricidaniel — Join the AI Marketing Hub community
🆓 Free  → https://www.skool.com/ai-marketing-hub
⚡ Pro   → https://www.skool.com/ai-marketing-hub-pro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
