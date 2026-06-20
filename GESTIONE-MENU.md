# Gestione menù da Airtable — Gelateria Punto G!

Questa guida spiega come i proprietari possono **aggiungere, togliere e attivare/disattivare**
gusti, basi e topping **in autonomia**, senza toccare il codice del sito.

I dati del sito (gusti del menù e opzioni del configuratore torte) vengono presi da **Airtable**,
un foglio online tipo Excel. Quando modifichi una tabella, il sito si aggiorna da solo.

---

## Come funziona (in breve)

1. I gusti/basi/topping vivono in tabelle Airtable, ognuna con una casella **Attivo** ✓.
2. Quando il sito viene ripubblicato, scarica da Airtable **solo le voci con Attivo spuntato**.
3. Se Airtable non fosse raggiungibile, il sito continua a funzionare con l'ultima versione
   valida dei dati (c'è una copia di sicurezza dentro al sito): **il menù non sparisce mai**.

> ℹ️ Le chiavi di accesso ad Airtable restano sul server di pubblicazione (Vercel) e **non**
> sono visibili nel browser dei visitatori.

---

## PARTE 1 — Configurazione iniziale (si fa UNA volta sola)

> Questa parte è tecnica: la fa lo sviluppatore (o chi ha dimestichezza). Una volta fatta,
> i proprietari useranno solo la **Parte 2**.

### 1.1 — Crea il "base" su Airtable e importa i dati

1. Vai su [airtable.com](https://airtable.com), accedi e crea un nuovo **Base** (chiamalo es. `Gelateria Punto G`).
2. Importa, una per una, le 8 tabelle dalla cartella **`airtable-import/`** di questo progetto:
   - In Airtable: pulsante **Add or import → CSV file**, carica il file, e **rinomina la tabella**
     col nome indicato qui sotto (i nomi devono coincidere **esattamente**):

   | File CSV               | Nome tabella in Airtable |
   |------------------------|--------------------------|
   | `categorie.csv`        | `Categorie`              |
   | `gusti.csv`            | `Gusti`                  |
   | `gusti-torte.csv`      | `Gusti Torte`            |
   | `tipi-torta.csv`       | `Tipi Torta`             |
   | `dimensioni.csv`       | `Dimensioni`             |
   | `basi.csv`             | `Basi`                   |
   | `decorazioni.csv`      | `Decorazioni`            |
   | `occasioni.csv`        | `Occasioni`              |

   I CSV contengono **già tutti i gusti e le opzioni attuali**: non devi riscrivere nulla.

### 1.2 — Imposta i tipi di colonna (importante)

Dopo l'import, sistema il tipo di alcune colonne (clic sull'intestazione → *Edit field* → *Type*):

- In **tutte** le tabelle: colonna **`In vetrina`** → tipo **Checkbox**. (I valori `true` diventeranno spunte ✓.)
  Questa è la casella che accende/spegne ogni voce sul sito.
- Tabelle **Gusti**, **Gusti Torte**, **Tipi Torta**, colonna **`Colore`** → **Single select**.
  Le opzioni sono i **nomi colore** già presenti (es. `Pistacchio`, `Cioccolato fondente`): così si
  sceglie il colore da un menù a tendina, **senza scrivere codici**. Vedi 1.2-bis per dare ai chip
  il colore giusto.
- Tabella **Gusti**, colonna **`Categoria`** → **Single select**, con esattamente queste opzioni:
  `Creme`, `Frutta & Veggy`, `Semifreddi`, `Altre Leccornie` (devono combaciare con `Categorie.Nome`).
- Tabella **Gusti**, colonna **`Tag`** → **Single select**, opzioni: `firma`, `vegan`, `stagione` (più "vuoto").
- Tabella **Dimensioni**, colonna **`Popolare`** → **Checkbox**.
- Colonne numeriche → tipo **Number**: `Ordine` (tutte), `PrezzoBase`, `Diametro`, `Supplemento`.

### 1.2-bis — Colori del menù a tendina (facoltativo ma consigliato)

Il file `airtable-import/colori-palette.csv` elenca i nomi colore e il loro codice
(es. `Pistacchio → #7ea15a`). Quando converti la colonna **`Colore`** in *Single select*, Airtable
crea le opzioni ma con colori di chip casuali. Per renderle riconoscibili a colpo d'occhio puoi,
una volta sola, assegnare a ogni opzione il colore più simile dalla tavolozza di Airtable
(*Edit field → Customize option colors*). Non è obbligatorio: i nomi bastano già a scegliere.

> Sul sito il colore esatto resta quello reale del gelato: i nomi sono solo un'etichetta comoda.

### 1.3 — Crea il token di accesso

1. Vai su [airtable.com/create/tokens](https://airtable.com/create/tokens) → **Create new token**.
2. **Scopes**: aggiungi `data.records:read`.
3. **Access**: aggiungi il base `Gelateria Punto G`.
4. Copia il token (inizia con `pat...`): lo userai come `AIRTABLE_TOKEN`.
5. Recupera l'**ID del base** (`AIRTABLE_BASE_ID`, inizia con `app...`): lo trovi nell'URL del base
   o su [airtable.com/api](https://airtable.com/api) selezionando il base.

### 1.4 — Imposta le variabili su Vercel

Nel progetto su Vercel: **Settings → Environment Variables**, aggiungi (per Production e Preview):

| Nome                | Valore                          |
|---------------------|---------------------------------|
| `AIRTABLE_TOKEN`    | il token `pat...`               |
| `AIRTABLE_BASE_ID`  | l'id del base `app...`          |

### 1.5 — Fai aggiornare il sito quando si modifica Airtable

Perché le modifiche vadano online serve una nuova pubblicazione. Si automatizza così:

1. **Vercel** → *Settings → Git → Deploy Hooks* → crea un hook (es. nome `airtable-sync`,
   branch `main`). Copia l'URL generato.
2. **Airtable** → in alto a destra **Automations → Create automation**:
   - **Trigger**: *When a record is updated* (consiglio sulla tabella `Gusti`; puoi crearne
     altre uguali per `Basi`, `Decorazioni`, ecc.).
   - **Action**: *Run a script*, e incolla:
     ```js
     // Incolla qui l'URL del Deploy Hook copiato da Vercel
     await fetch('INCOLLA_QUI_URL_DEPLOY_HOOK', { method: 'POST' });
     ```
   - Attiva l'automazione (**Turn on**).

Da quel momento, ogni modifica su Airtable fa ripubblicare il sito da sola (in genere **1–2 minuti**).

### 1.6 — Verifica

Localmente puoi provare la sincronizzazione creando un file `.env` con le due variabili e lanciando:

```bash
npm run sync   # scarica da Airtable e aggiorna src/data/generated/
npm run dev    # apri il sito e controlla
```

---

## PARTE 2 — Uso quotidiano (per i proprietari) 🍦

Tutto si fa dal foglio **Airtable** (anche da telefono, con l'app Airtable). **Niente codice.**

La casella che conta è **`In vetrina`**: spunta ✓ = il gusto si vede sul sito, spunta vuota = nascosto.

### ✅ Disattivare un gusto finito
1. Apri la tabella **Gusti**.
2. Trova la riga del gusto (es. *Pistacchio*).
3. **Togli la spunta** dalla colonna **In vetrina**.
4. Fatto: tra 1–2 minuti sparisce dal sito.

> **Disattivare non è cancellare.** Il gusto resta nella tabella, in archivio: quando torna di
> stagione basta **rimettere la spunta** e ricompare. Così non perdi mai nomi, colori e ordine.

### 🔁 Far tornare un gusto
- Rimetti la **spunta** su **In vetrina**. Ricompare sul sito.

### ➕ Aggiungere un gusto nuovo
1. Nella tabella **Gusti**, aggiungi una **riga** in fondo.
2. Compila:
   - **Nome**: es. `Tiramisù`
   - **Categoria**: scegli dal menù a tendina (es. `Creme`)
   - **Colore**: è il pallino colorato accanto al gusto. **Scegli un colore dal menù a tendina**
     (es. `Crema`, `Pistacchio`, `Cioccolato fondente`). Se non sai quale, **lascialo vuoto**: ne
     mettiamo uno neutro.
   - **Tag**: lascia vuoto, oppure scegli `firma` / `vegan` / `stagione`.
   - **In vetrina**: metti la **spunta** ✓.

### 🍰 Basi e topping delle torte
- **Basi** → tabella **Basi** (colonne: Nome, Descrizione, Supplemento €).
- **Topping/decorazioni** → tabella **Decorazioni**.
- Stessa logica: spunta **In vetrina** per mostrarle, togli la spunta per nasconderle, aggiungi una
  riga per crearne di nuove.

### 🍦 Due liste di gusti (è voluto!)
Ci sono **due** elenchi di gusti, separati di proposito perché spesso sono diversi:
- **Gusti** = i gusti della **carta del gelato** mostrata sul sito.
- **Gusti Torte** = i gusti che il cliente può scegliere **dentro il configuratore torte**.

Se un gusto deve comparire in entrambi, va messo in **tutte e due** le tabelle. Tienile separate:
in vasca puoi avere gusti che non vendi come torta, e viceversa.

### Altre tabelle (cambiano di rado)
- **Tipi Torta**, **Dimensioni**, **Occasioni**: opzioni del configuratore. Si modificano allo stesso modo.

### 📸 Foto delle torte
Nella tabella **Tipi Torta** la colonna **Immagine** può contenere una foto. Se la trasformi in un
campo **Attachment**, i proprietari possono caricare una foto **direttamente dal telefono**: il sito
usa in automatico una versione **alleggerita** della foto, quindi resta veloce anche con scatti pesanti.

### Domande frequenti
- **Quanto ci mette ad aggiornarsi?** In genere 1–2 minuti dopo la modifica.
- **Ho sbagliato qualcosa, ho rotto il sito?** No: se un dato è incompleto il sito usa la copia
  di sicurezza e resta online. Correggi con calma su Airtable.
- **Posso cancellare una riga invece di disattivarla?** Sì, ma **disattivare (togliere `In vetrina`)
  è più prudente**: così non perdi il gusto e puoi riattivarlo quando torna.
- **Come vedo a colpo d'occhio cosa è nascosto?** In Airtable puoi *raggruppare* la tabella per
  `In vetrina` (menù *Group*): vedrai separati "in vetrina" e "in archivio".

---

## Riferimento — tabelle e colonne

| Tabella       | Colonne                                                            |
|---------------|-------------------------------------------------------------------|
| Categorie     | Id, Nome, Descrizione, In vetrina, Ordine                         |
| Gusti         | Nome, Categoria, Colore, Tag, In vetrina, Ordine                  |
| Gusti Torte   | Nome, Colore, In vetrina, Ordine                                  |
| Tipi Torta    | Id, Nome, Descrizione, PrezzoBase, Immagine, Colore, In vetrina, Ordine |
| Dimensioni    | Id, Etichetta, Diametro, Supplemento, Popolare, In vetrina, Ordine |
| Basi          | Id, Nome, Descrizione, Supplemento, In vetrina, Ordine            |
| Decorazioni   | Id, Nome, Descrizione, Emoji, In vetrina, Ordine                  |
| Occasioni     | Nome, In vetrina, Ordine                                          |

- **In vetrina**: casella (checkbox). Spuntata = visibile sul sito; vuota = nascosta (in archivio).
- **Colore**: menù a tendina con i nomi della palette (`Pistacchio`, `Cioccolato fondente`, …).
- **Ordine**: numero che decide la posizione (più basso = appare prima).
- **Id**: non modificarlo per le righe esistenti; per righe nuove lascialo vuoto (viene generato dal Nome).
- I **nomi delle tabelle e delle colonne** devono restare invariati: sono usati dallo script
  `scripts/build-data.mjs`. Se vuoi cambiarli, aggiorna anche quel file.

---

## Per lo sviluppatore — file coinvolti

- `scripts/build-data.mjs` — scarica da Airtable in fase di build (lanciato da `npm run build`).
- `scripts/seed-from-fallback.mjs` — rigenera dati iniziali e CSV (`npm run seed`).
- `scripts/palette.mjs` — palette colori (nome ↔ codice esadecimale), usata da build e seed.
- `scripts/optimize-images.mjs` — comprime le immagini in `public/` (`npm run optimize-images`).
- `src/data/generated/` — dati scaricati da Airtable (commitati come "ultima versione valida").
- `src/data/fallback/` — copia di sicurezza scritta a mano (usata se Airtable manca).
- `src/data/flavors.js`, `src/data/cakeOptions.js` — scelgono i dati generati o, se non validi, il fallback.
- `airtable-import/` — i CSV da importare in Airtable la prima volta (+ `colori-palette.csv` di riferimento).
