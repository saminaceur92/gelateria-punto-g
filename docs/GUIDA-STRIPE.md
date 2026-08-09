# 💳 Attivare Stripe per incassare davvero

Il sito è già pronto a incassare: manca solo collegare un account Stripe **intestato alla
gelateria**. Questa è la sequenza esatta, con accanto a ogni passo chi lo deve fare.
Serve circa **un'ora**, di cui mezz'ora insieme al titolare.

---

## Dati dell'attività (già raccolti)

| | |
|---|---|
| Ragione sociale | Gelateria Punto Gi S.r.l. |
| Forma giuridica | **S.r.l. — società di capitali** *(trasformata di recente dalla s.n.c.)* |
| Partita IVA | 03578310363 *(da riconfermare sulla visura aggiornata)* |
| Sede | Via Remesina Interna 46, 41012 Carpi (MO) |
| Telefono | +39 320 330 6009 |
| Sito | gelateria-punto-g.vercel.app |

---

## ⚠️ La decisione che non si può sbagliare

L'account Stripe deve essere **della gelateria, non tuo**.

Stripe versa gli incassi sull'IBAN dell'intestatario: se l'account fosse tuo, i ricavi della
gelateria arriverebbero sul tuo conto e diventerebbero reddito tuo — un problema fiscale serio
per entrambi.

Tu entri come **membro del team** (passo 6): hai tutto l'accesso tecnico senza toccare i soldi,
e se un domani smettete di lavorare insieme il titolare ti rimuove con un clic tenendosi l'account.

---

## Prima di iniziare — cosa far preparare

Fai arrivare il titolare all'appuntamento con queste cose, altrimenti vi bloccate a metà:

- [ ] **Documento d'identità** valido del rappresentante legale, fronte e retro
- [ ] **Codice fiscale** del rappresentante legale
- [ ] **Visura camerale aggiornata**: P.IVA, codice fiscale della società, numero REA, capitale sociale
- [ ] **IBAN del conto intestato alla società** — non un conto personale
- [ ] **Dati dei soci con più del 25%** delle quote: nome, cognome, data di nascita, codice fiscale, indirizzo, percentuale
- [ ] **Dati dell'amministratore** (se diverso dai soci sopra)
- [ ] Un'**email aziendale** che resterà valida negli anni (non la tua)
- [ ] Un **telefono** a portata di mano per i codici di verifica

> **Perché i soci?** La normativa antiriciclaggio obbliga Stripe a identificare i titolari
> effettivi. Per una S.r.l. sono i soci oltre il 25% delle quote, più l'amministratore.
> È la stessa cosa che chiede la banca: se il titolare
> si insospettisce, rassicuralo.

---

## La procedura

### 1. Creare l'account — 👤 Titolare

Andate su **stripe.com** → *Inizia ora*. Registratevi con **l'email aziendale della gelateria**
e una password che il titolare conserva. Paese: **Italia**. Confermate l'email.

Fatelo fare materialmente a lui, con te accanto che guidi. È il suo account.

### 2. Dichiarare il tipo di attività — 👤 Titolare

Alla domanda sul tipo di attività scegliete **Società → Società a responsabilità limitata (S.r.l.)**, cioè una *società di capitali*.

> ⚠️ **Non scegliete "Ditta individuale" né "Società di persone".** La gelateria è diventata
> S.r.l. da poco: dichiarare la forma vecchia fa respingere la verifica.

Settore: *Alimentari / Ristorazione* → gelateria o pasticceria. Poi ragione sociale, P.IVA,
indirizzo della sede e telefono (li trovi nella tabella qui sopra).

### 3. Amministratore e titolari effettivi — 👤 Titolare

Inserite i dati dell'**amministratore / rappresentante legale** e caricate il documento d'identità.
Poi aggiungete i **titolari effettivi**: per una S.r.l. sono i soci con **più del 25%** delle quote.
Se nessuno supera il 25%, si indica l'amministratore. La visura riporta le percentuali esatte.

La verifica di solito è immediata, ma può richiedere **fino a un paio di giorni lavorativi**:
mettete in conto che il go-live potrebbe slittare di 48 ore.

### 4. IBAN per gli accrediti — 👤 Titolare

Inserite l'**IBAN del conto intestato alla società**. Deve corrispondere alla ragione sociale,
altrimenti Stripe blocca i versamenti.

Gli accrediti partono in automatico: per i nuovi account italiani in genere dopo circa **7 giorni**
dal primo incasso, poi la cadenza si accorcia.

### 5. Attivare i metodi di pagamento — 👤 Titolare

**Impostazioni → Metodi di pagamento.** Attivate:

- **Carte** e **Apple Pay / Google Pay** — immediati
- **PayPal** e **Satispay** — possono richiedere una verifica in più

Sistemate anche **Impostazioni → Dati pubblici**: nome, logo e soprattutto la **dicitura
sull'estratto conto** — qualcosa di riconoscibile come `GELATERIA PUNTO GI`. Se il cliente non
riconosce l'addebito, contesta il pagamento.

### 6. Aggiungere te al team — 👤 Titolare

**Impostazioni → Team** → invita la tua email con ruolo **Sviluppatore**.

Da qui in poi la parte tecnica la fai tu, senza che lui debba condividere password né toccare chiavi.

### 7. Chiavi e webhook — 🛠️ Tu

Entra col tuo accesso e passa in **modalità Live** (interruttore in alto).

**a. Chiave segreta** — *Sviluppatori → Chiavi API* → rivela la **chiave segreta** (`sk_live_…`).
Non passarla su WhatsApp o email: usala direttamente nel comando qui sotto.

**b. Webhook** — *Sviluppatori → Webhook* → aggiungi endpoint:

```
https://bqmoxdeagqpzvcblpcbm.supabase.co/functions/v1/stripe-webhook
```

Evento da ascoltare: **solo** `checkout.session.completed`.
Salva e copia il **signing secret** (`whsec_…`).

**c. Secret e redeploy:**

```bash
npx supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  SITE_URL=https://gelateria-punto-g.vercel.app \
  --project-ref bqmoxdeagqpzvcblpcbm

npx supabase functions deploy create-checkout --project-ref bqmoxdeagqpzvcblpcbm
npx supabase functions deploy stripe-webhook --no-verify-jwt --project-ref bqmoxdeagqpzvcblpcbm
```

> ⚠️ **Quando comprate il dominio definitivo**, `SITE_URL` va aggiornato qui, altrimenti dopo
> il pagamento il cliente viene rimandato al vecchio indirizzo.

### 8. Prova finale con soldi veri — 🛠️ Tu

In Live le carte di test non funzionano più: serve un ordine vero, di importo piccolo.

1. Configura una torta sul sito e paga con una carta vera
2. Controlla che arrivi la **notifica Telegram** in gelateria
3. Controlla che l'ordine compaia in dashboard tra i **"Da fare"**
4. Controlla che al cliente arrivi l'**email di conferma**
5. Su Stripe, *Pagamenti* → il pagamento risulta riuscito
6. **Rimborsa l'ordine di prova** da Stripe e cancellalo dalla dashboard

Il rimborso restituisce l'importo ma **non** la commissione: la prova costa qualche decina di
centesimi. È il modo più economico per dormire tranquilli.

---

## Quanto costa

| Metodo | Commissione indicativa | Su una torta da €34 |
|---|---|---|
| Carte UE | 1,5% + €0,25 | ≈ €0,76 |
| Carte extra-UE | più alta | — |
| PayPal / Satispay via Stripe | tariffa Stripe | — |

Le tariffe cambiano nel tempo e si possono negoziare a volume: **verificale nel pannello Stripe**
prima di comunicarle al titolare. Nessun canone fisso, si paga solo sull'incassato.

---

## ⚠️ Da girare al commercialista

Le vendite online sono **commercio elettronico indiretto** e vanno gestite fiscalmente
(corrispettivi o fattura). Stripe incassa e basta: **non emette scontrini né fatture** al posto
vostro. Fai presente al titolare di parlarne col suo commercialista **prima** di andare live.

---

## Checklist finale

- [ ] Account intestato alla gelateria, non a te
- [ ] Tipo attività: Società di capitali (S.r.l.)
- [ ] Amministratore verificato e titolari effettivi (soci oltre il 25%) inseriti
- [ ] IBAN della società collegato
- [ ] Metodi di pagamento attivi
- [ ] Dicitura estratto conto riconoscibile
- [ ] Tu nel team come sviluppatore
- [ ] Chiavi Live nei secret Supabase e funzioni ridistribuite
- [ ] Webhook attivo su `checkout.session.completed`
- [ ] Ordine di prova completato, verificato e rimborsato
- [ ] Commercialista informato

---

Finché tutto questo non è fatto il sito resta in **modalità test**: si può ordinare, ma nessun
soldo si muove davvero. Non c'è alcun rischio a lasciarlo così finché non siete pronti.
