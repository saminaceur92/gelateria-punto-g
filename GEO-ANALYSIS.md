# GEO Analysis — gelateria-punto-g.vercel.app

**Data:** agosto 2026
**Cosa misura:** quanto il sito è citabile da ChatGPT, Perplexity, Google AI Overviews e Claude.

> Nota metodologica: Google dichiara esplicitamente che "ottimizzare per la ricerca generativa
> è ancora SEO" e che GEO/AEO sono etichette nuove per lo stesso lavoro. Questo report tratta
> quindi i rilievi come fondamentali SEO applicati alle superfici AI, non come disciplina separata.

---

## 1. GEO Readiness Score: 34/100

| Dimensione | Peso | Punteggio | Stato |
|---|---|---|---|
| Citability | 25% | 5/25 | 🔴 Critico |
| Leggibilità strutturale | 20% | 7/20 | 🔴 Basso |
| Contenuto multi-modale | 15% | 5/15 | 🟡 Parziale |
| Authority & brand signals | 20% | 8/20 | 🟡 Parziale |
| Accessibilità tecnica | 20% | 9/20 | 🟡 Parziale |
| **TOTALE** | | **34/100** | |

---

## 2. Breakdown per piattaforma

| Piattaforma | Stima | Perché |
|---|---|---|
| **Google AI Overviews** | ~45/100 | Google **esegue** il JavaScript, quindi vede il sito. Limite: dipende dal posizionamento organico, e il dominio è nuovo e senza autorità |
| **Google AI Mode** | ~35/100 | Bacino più ampio ma premia freschezza e autorità di entità: qui manca l'entità consolidata |
| **ChatGPT** | ~20/100 | Attinge da indice Bing, Wikipedia (47,9%) e Reddit (11,3%). Il sito **non è su Bing Places**, non ha Wikipedia né Reddit. E non esegue JS |
| **Perplexity** | ~20/100 | La sua fonte #1 è Reddit (46,7%): presenza zero |

**Solo l'11% dei domini** viene citato sia da ChatGPT sia da Google AI Overviews per la stessa query: sono superfici da trattare separatamente.

---

## 3. AI Crawler Access — ✅ RISOLTO

| Crawler | Stato |
|---|---|
| GPTBot (OpenAI) | ✅ ammesso |
| OAI-SearchBot | ✅ ammesso |
| ChatGPT-User | ✅ ammesso |
| ClaudeBot / Claude-SearchBot | ✅ ammessi |
| PerplexityBot | ✅ ammesso |
| Google-Extended | ✅ ammesso |
| `/admin` | ✅ escluso correttamente |

`robots.txt` è **live e corretto** (verificato: HTTP 200). Questa parte è a posto.

---

## 4. llms.txt — assente (impatto reale: minimo)

Non presente. **Non è un problema per Google**: la guida ufficiale (aggiornata 29/06/2026) dice
esplicitamente che `llms.txt` non serve per Google Search né per le sue funzioni generative, e che
"non danneggia né aiuta" il posizionamento. Mueller lo ha definito "un vicolo cieco".

Ha senso solo per alcuni servizi AI non-Google e per gli agent. **Priorità bassa** — non è la leva
che qualcuno in giro racconta.

---

## 5. 🔴 IL PROBLEMA CENTRALE: i crawler AI non vedono il sito

**I crawler AI non eseguono JavaScript.** Il sito è un'applicazione React interamente client-side:
l'HTML che arriva al crawler è `<div id="root"></div>` più i meta tag.

### Verifica empirica

Richiesta reale come `GPTBot/1.0` alla home — questo è **tutto** ciò che riceve:

```
{ "@context": "https://schema.org", "@type": "IceCreamShop",
  "name": "Gelateria Punto Gi", "description": "Gelateria artigianale a Carpi (MO)…" }
```

Nient'altro. Nessun gusto, nessun orario nel corpo, nessuna storia, nessuna gallery.
Il JSON-LD aggiunto ieri è **l'unica cosa** che un'AI riesce a leggere del sito.

### 🔴 E la pagina più preziosa è invisibile

`/allergeni` è il vostro miglior contenuto citabile in assoluto: dato originale, strutturato,
che risponde a una domanda precisa e ad alto intento ("gelato senza glutine a Carpi",
"gelateria per intolleranti al lattosio").

**Verifica:** l'HTML di `/allergeni` è **byte per byte identico** a quello della home
(stesso md5: `dff1a908…`). Per un crawler senza JS:

- non esiste alcun contenuto sugli allergeni
- il `<title>` è quello della home → **titolo duplicato**
- la description è quella della home → **description duplicata**
- lo schema è quello della home → nessun segnale specifico

Il rewrite SPA di Vercel serve `index.html` per ogni rotta: funziona per gli utenti, è
trasparente per Google (che renderizza), **ma azzera la pagina per le AI**.

---

## 6. Brand mention analysis

Le menzioni di brand correlano **3× più dei backlink** con le citazioni AI (Ahrefs, 75.000 brand).

| Piattaforma | Presenza | Correlazione con citazioni AI |
|---|---|---|
| **YouTube** | ❌ assente | ~0,737 — **la più forte in assoluto** |
| **Reddit** | ❌ assente | alta (fonte #1 di Perplexity) |
| **Wikipedia** | ❌ assente | alta (47,9% delle fonti ChatGPT) |
| LinkedIn | ❌ assente | moderata |
| Instagram | ✅ @gelateriapuntogicarpi | — |
| Facebook | ✅ 98% su 37 recensioni | — |
| TripAdvisor | ⚠️ presente ma duplicato | — |
| Deliveroo | ✅ presente | — |
| Italia.it | ✅ presente | — |
| Wanderlog "30 best desserts in Carpi" | ✅ presente | ⭐ le "best of" list sono il fattore #1 di visibilità AI |
| **Bing Places** | ❌ assente | 🔴 alimenta ChatGPT, Copilot, Alexa |

### 🔴 Confusione di entità — il brand è frammentato

Le AI devono capire che esiste **una** attività. Ora trovano segnali sparsi:

| Cosa | Stato |
|---|---|
| `gelateriapuntogicarpi.my.canva.site` | 🔴 **ANCORA ONLINE (HTTP 200)** — vecchio sito Canva che compete con quello nuovo |
| `gelateriapuntogi.altervista.org` | 🟡 archiviato (403) ma ancora indicizzabile |
| TripAdvisor / Sluurpy | 🔴 doppia scheda "Punto G" e "Punto Gi" |
| OpenStreetMap | 🟡 registrato come "Punto G" (nome vecchio) — alimenta Apple Maps e varie app |
| `@gelateria_puntog_fossoli` | ⚠️ **da chiarire**: è una vostra seconda sede a Fossoli o un'altra attività? Cambia la strategia |

Finché esistono più siti e più schede per lo stesso nome, ogni AI deve indovinare quale sia
l'attività vera. È il motivo principale per cui il punteggio brand resta basso nonostante
ci siano ottime recensioni.

---

## 7. Server-Side Rendering check

| Aspetto | Stato |
|---|---|
| Rendering | ❌ Solo client-side (`is_spa=true`, 3.599 ms di render con Playwright) |
| Contenuto nell'HTML statico | ❌ Nessuno (solo meta + JSON-LD) |
| Schema in HTML statico | ✅ Presente (aggiunto ieri) |
| Rotte con HTML proprio | ❌ Tutte identiche a `index.html` |

---

## 8. Top 5 interventi a maggior impatto

### 1. 🔴 Rendere `/allergeni` una pagina statica vera
*Osservazione:* il contenuto più citabile del sito è invisibile ai crawler AI e duplica home.
*Come:* prerender in build (`vite-plugin-ssg`/`vite-plugin-prerender`) oppure — più semplice e
già sufficiente — generare in build un `allergeni.html` con title/description propri, il
contenuto degli allergeni in HTML e uno schema dedicato. I dati sono già in Supabase e
`build-data.mjs` gira già in fase di build: l'infrastruttura c'è.
*Come sapere se ha funzionato:* `curl -A GPTBot .../allergeni` mostra i gusti e gli allergeni.
*Indicatore:* comparsa in risposte AI per "gelato senza glutine Carpi".

### 2. 🔴 Spegnere o reindirizzare il vecchio sito Canva
*Osservazione:* `gelateriapuntogicarpi.my.canva.site` è vivo e compete per lo stesso brand.
*Come:* redirect 301 al sito nuovo, o pubblicare solo un rimando. Azione del titolare.
*Fallisce se:* fra un mese il vecchio sito compare ancora nelle ricerche di brand.

### 3. 🔴 Aprire Bing Places
*Osservazione:* ChatGPT non legge Google Business Profile, attinge dall'indice **Bing**.
Con il 45% degli utenti che chiede consigli locali all'AI e ChatGPT che converte al 15,9%
(contro l'1,76% dell'organico Google), è il canale peggio coperto rispetto al suo valore.
*Costo:* gratis, 30 minuti.

### 4. 🟠 Consolidare l'entità
Unire le schede duplicate (TripAdvisor, Sluurpy), correggere il nome su OpenStreetMap,
chiarire la posizione di Fossoli, aggiungere alla proprietà `sameAs` dello schema **tutti**
i profili ufficiali (ora ci sono solo Facebook e Instagram: vanno aggiunti TripAdvisor,
Deliveroo, PagineGialle, Italia.it).

### 5. 🟠 Blocchi di risposta auto-contenuti da 134-167 parole
*Osservazione:* è la lunghezza ottimale per la citazione, e **il 44% delle citazioni AI
proviene dal primo 30% della pagina**.
*Cosa scrivere:* paragrafi che rispondono in modo compiuto a "dove mangiare un gelato
senza glutine a Carpi?", "quali gusti vegan avete?", "come si ordina una torta gelato?" —
con la risposta completa nelle prime 40-60 parole. Da mettere nella parte alta della pagina,
non in fondo.

---

## 9. Schema — stato e integrazioni

✅ **Già fatto:** `IceCreamShop` con NAP, coordinate reali verificate, orari, areaServed, sameAs.

**Da aggiungere:**
- `sameAs` esteso a tutti i profili ufficiali (rafforza l'identità di entità per le AI)
- Schema dedicato su `/allergeni` una volta resa statica: `Menu` + `MenuSection` + `MenuItem`
  con `suitableForDiet` (`GlutenFreeDiet`, `VeganDiet`, `LowLactoseDiet`) — è dato machine-readable
  esattamente su ciò che le persone chiedono alle AI
- `aggregateRating` con i dati reali delle recensioni

---

## 10. Riformulazioni di contenuto suggerite

Nessuna riscrittura urgente del testo esistente: **il problema non è come è scritto, è che
le AI non lo vedono**. Ha senso lavorare sui testi solo dopo aver risolto il punto 1.

Dopo, in ordine: aggiungere in cima alla home un blocco che dica in modo compiuto chi siete,
dove siete e cosa vi distingue (senza lattosio, vegan, senza glutine, torte su ordinazione);
e su `/allergeni` un'intro di ~150 parole che risponda direttamente a "questa gelateria è
adatta a chi ha intolleranze?".

---

## Limitazioni

Non verificabile da qui: se il sito compare **davvero** oggi nelle risposte di ChatGPT/Perplexity
per query come "gelateria Carpi" (serve `ai_optimization_chat_gpt_scraper` di DataForSEO);
volumi di ricerca reali; posizionamento organico attuale (serve Search Console).

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Built by agricidaniel — Join the AI Marketing Hub community
🆓 Free  → https://www.skool.com/ai-marketing-hub
⚡ Pro   → https://www.skool.com/ai-marketing-hub-pro
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
