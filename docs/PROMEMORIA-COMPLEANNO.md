# Promemoria compleanno e anniversario — come funzionano e come si attivano

Chi ordina una torta scegliendo **occasione "Compleanno" o "Anniversario"** e lascia l'email
riceve, l'anno successivo, **due mail**: 30 e 14 giorni prima della data della festa (il ritiro di
un anno prima). Dentro c'è la torta di allora e il link per rifarla con un clic.

Tutto gira su Supabase (nessun server nuovo): un trigger mette i promemoria in coda quando l'ordine
viene creato, un giro automatico (`pg_cron`) li spedisce via EmailJS con `pg_net` — la stessa
tecnica già usata per le notifiche Telegram.

**Regole contro i doppioni e le mail di troppo** (dal 09/10/2026, migrazione
`2026-10-09-promemoria-ricorrenze.sql`):

- le mail partono **fra le 9 e le 12** (ora italiana), **una alla volta**, e **al massimo una al
  giorno per indirizzo**;
- **la stessa festa con due ordini** (doppio pagamento, due torte, ordine rifatto: stessa email,
  stessa occasione, date a 3 giorni o meno) riceve le mail **una volta sola**;
- **ordine annullato** → i suoi promemoria si fermano (e ripartono se l'ordine torna fra quelli da
  fare); email, data o occasione corrette sull'ordine → i promemoria non ancora partiti si
  aggiornano da soli;
- **chi ha già ordinato** negli ultimi 60 giorni (stessa email o stesso telefono), o ha già una
  torta prenotata per quella festa, non riceve il promemoria;
- **una mail già partita non riparte mai**: né da «Invia ora», né da «Rimetti in coda».

---

## 1. Esegui le migrazioni

Dal **SQL Editor** di Supabase, in quest'ordine (le prime quattro sono già state fatte a
luglio/agosto 2026):

1. `migrations/2026-07-26-promemoria-compleanno.sql` — la coda, i disiscritti, il trigger, il giro;
2. `migrations/2026-07-26-fix-token-promemoria.sql`;
3. `migrations/2026-07-26-fix-invio-promemoria.sql`;
4. `migrations/2026-08-10-dominio-definitivo.sql`;
5. **`migrations/2026-10-09-promemoria-ricorrenze.sql`** — anniversario, «togli solo questo»,
   regole contro i doppioni. Va lanciata **tutta insieme**; si può rilanciare senza danni. In fondo
   stampa un controllo: ogni riga deve dire quello che c'è scritto fra parentesi (ok / no / sì / 0 / 2).

Facoltativo ma consigliato, subito dopo la 5: `migrations/2026-10-09-promemoria-ricorrenze-prova.sql`.
Prova tutto sul database vero con ordini finti e **annulla da sola** quello che ha scritto: deve
finire con l'errore voluto **«PROVE SUPERATE»**. Non parte nessuna mail e nessun messaggio Telegram.

> Se dopo la 5 si rilancia `migrations/2026-10-09-dashboard-ottobre.sql`, nel suo controllo finale
> la riga «16 · nessun automatismo parte quando si salva una nota» dice «da controllare»: è il
> trigger dei promemoria (`sincronizza_promemoria_trg`), che scatta solo quando sull'ordine
> cambiano stato, data di ritiro, email, nome, occasione o interruttore dei promemoria, **mai**
> quando si salva una nota. Va bene così.

Finché non ci sono le chiavi EmailJS (passo 3) **non parte nessuna mail**: la coda si riempie e
basta, non si perde niente.

## 2. Il template su EmailJS

Si usa **lo stesso template** del promemoria compleanno (`template_1jgkt0l`): il piano gratuito di
EmailJS ne consente due, e sono già usati da conferma ordine e promemoria. Le parole che cambiano
fra compleanno e anniversario le manda il database.

> ⚠️ **Aggiorna il template DOPO aver lanciato la migrazione 5.** Prima, il database non manda le
> variabili nuove (`ricorrenza`, `emoji`, `link_togli`…) e le mail uscirebbero con dei buchi
> («Giulia,  si avvicina!»).

Su [emailjs.com](https://dashboard.emailjs.com/) → **Email Templates** → *Promemoria compleanno*.

**Riquadro a destra** (come prima):

| Campo | Valore |
|---|---|
| To Email | `{{email}}` |
| From Name | `Gelateria Punto Gi` |
| From Email | lasciare *Use Default Email Address* |
| Reply To | **vuoto** (se resta `{{email}}` le risposte tornano al cliente) |
| Bcc / Cc | vuoti |

**Subject** (cambia):

```
{{cliente}}, {{ricorrenza}} si avvicina! {{emoji}}
```

**Content** (bottone *Edit Content* → cancellare tutto e incollare):

```html
<div style="font-family: Arial, Helvetica, sans-serif; color:#33291f; font-size:15px; line-height:1.6;">
  <p>Ciao {{cliente}}! {{emoji}}</p>
  <p>Un anno fa, il {{anno_scorso}}, hai festeggiato con una torta fatta da noi:<br>
     <strong>{{torta}}</strong></p>
  <p>{{ricorrenza_maiuscola}} si avvicina di nuovo (<strong>{{quando}}</strong>): ti va di rifarla?</p>
  <p style="margin:28px 0;">
    <a href="{{link_torta}}" style="background:#2c7699;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold;display:inline-block;">Rifai questa torta</a>
  </p>
  <p style="color:#6b6b7b;font-size:13px;">È già pronta come l'anno scorso: devi solo scegliere il giorno e confermare. Per le torte servono almeno 5 ore di preavviso.</p>
  <p>Ti aspettiamo!<br><strong>Gelateria Punto Gi</strong> — Via Remesina Interna 46, Carpi (MO)</p>
  <hr style="border:none;border-top:1px solid #e6e0d4;margin:24px 0;">
  <p style="color:#8a8073;font-size:12px;">
    Ricevi questa mail perché un anno fa hai ordinato da noi {{motivo}}.<br>
    <a href="{{link_togli}}" style="color:#8a8073;">Non ricordarmi più questa ricorrenza</a>
    &nbsp;·&nbsp;
    <a href="{{link_stop}}" style="color:#8a8073;">Non voglio più nessun promemoria</a>
  </p>
</div>
```

Rispetto a prima cambiano: l'oggetto, la prima riga (`{{emoji}}`), la frase «… si avvicina di
nuovo» (`{{ricorrenza_maiuscola}}`) e il piè di pagina (`{{motivo}}` e il link nuovo
`{{link_togli}}`). Il resto è uguale.

⚠️ Non devono restare `{{name}}`, `{{title}}`, `{{message}}`, `{{time}}`: sono le variabili del
modello di esempio, il database non le manda e lascerebbero righe vuote.

Variabili che il database invia:

| Variabile | Contiene | Esempio (compleanno / anniversario) |
|---|---|---|
| `{{cliente}}` | nome di battesimo | `Giulia` |
| `{{torta}}` | la torta dell'anno scorso | `Semifreddo — Pistacchio, Bacio` |
| `{{quando}}` | data della festa | `15/08/2027` |
| `{{anno_scorso}}` | data del ritiro di allora | `15/08/2026` |
| `{{ricorrenza}}` 🆕 | la festa, minuscolo | `il compleanno` / `l'anniversario` |
| `{{ricorrenza_maiuscola}}` 🆕 | la festa, a inizio frase | `Il compleanno` / `L'anniversario` |
| `{{emoji}}` 🆕 | | `🎂` / `🥂` |
| `{{motivo}}` 🆕 | perché riceve la mail | `una torta di compleanno` / `una torta per un anniversario` |
| `{{occasione}}` 🆕 | l'occasione (non serve nel testo) | `compleanno` / `anniversario` |
| `{{link_torta}}` | «rifai questa torta» | apre il configuratore già compilato |
| `{{link_togli}}` 🆕 | toglie **solo questa festa** | **va sempre messo** |
| `{{link_stop}}` | toglie **tutti** i promemoria | **obbligatorio, va sempre messo** |

I due link in fondo aprono una pagina del sito che **chiede sempre conferma** con un clic prima di
togliere qualcosa (alcuni antivirus aprono da soli i link delle mail: senza conferma
disiscrivevano il cliente). Nelle copie di **prova** i due link sono finti: aprono la pagina, ma
non tolgono niente al cliente vero.

## 3. Abilita l'invio da server e salva le chiavi

(Già fatto il 26/07/2026: serve solo se si rifà da capo.)

Le mail non partono dal browser ma dal database, quindi EmailJS va autorizzato:

1. EmailJS → **Account → General**
2. spunta **"Allow EmailJS API for non-browser applications"**
3. copia la **Private Key** dalla stessa pagina

Poi, dal SQL Editor di Supabase (sostituendo i valori):

```sql
insert into public.app_config (key, value) values
  ('emailjs_service_id',          'service_84b0jde'),
  ('emailjs_public_key',          'BTO4welmqMDIfQLbp'),
  ('emailjs_private_key',         'LA_TUA_PRIVATE_KEY'),
  ('emailjs_template_compleanno', 'template_1jgkt0l'),
  ('site_url',                    'https://www.gelateriapuntogi.it')
on conflict (key) do update set value = excluded.value;
```

`site_url` è la base dei link dentro le mail.

## 4. Prova la mail (senza ordini finti)

Nel gestionale, scheda **🎂 Promemoria**:

- **Prova** (su ogni mail) manda una copia a un indirizzo a scelta: il promemoria del cliente non
  cambia e i link per togliere sono finti;
- **🥂 Prova la mail di anniversario** (in alto) manda la versione anniversario, anche se in coda ci
  sono solo compleanni.

L'indirizzo va scritto la prima volta (per esempio quello della gelateria): poi il gestionale
propone l'ultimo usato su quel dispositivo. Non propone mai l'indirizzo con cui si entra col
codice (`staff-…@codici.gelateriapuntogi.it`): è tecnico e non riceve mail, e il database lo
rifiuta.

Controlla oggetto, emoji e frasi; il bottone «Rifai questa torta» apre il configuratore; i due link
in fondo aprono la pagina di prova («da qui non si toglie niente»).

> Niente più ordini di prova con la propria email: mettevano in coda promemoria veri per l'anno
> dopo. Se serve comunque un ordine di prova, nel riepilogo dello staff metti
> **«📧 Promemoria tra un anno: No»**.

## 5. Accendi i promemoria di anniversario

Finché il template non è aggiornato, i promemoria di anniversario **restano in coda** (non partono
con scritto «il compleanno»); il gestionale lo segnala con un avviso. Dopo aver aggiornato il
template (passo 2) e fatto la prova anniversario (passo 4), dal SQL Editor:

```sql
insert into public.app_config (key, value) values ('promemoria_template_ricorrenze', 'si')
on conflict (key) do update set value = excluded.value;
```

---

## Cose da sapere

- **Quando nascono**: per gli ordini con occasione «Compleanno» (dal 26/07/2026) e «Anniversario»
  (solo quelli fatti col sito nuovo, che mostra l'avviso: chi ha ordinato un anniversario prima non
  l'aveva visto, e la mail è promozionale). Il nome dell'occasione può cambiare in dashboard
  («Compleanno 🎂», «Anniversario di matrimonio»): finché contiene *compleann* o *anniversari*
  funziona.
- **L'avviso al cliente** compare sotto l'email e di nuovo nel riepilogo, prima di confermare. **Al
  banco** il cliente non lo vede: c'è l'interruttore «📧 Promemoria tra un anno» (acceso di
  partenza) e va detto a voce.
- **Togliere un promemoria**:
  - il cliente, dal link «Non ricordarmi più questa ricorrenza»: si ferma solo quella festa, gli
    altri promemoria restano e l'indirizzo **non** viene disiscritto. Vale **per sempre**: se
    riordina per la stessa festa (stessa email, stessa occasione, stesso giorno ±3, in qualunque
    anno, anche al banco) non nascono promemoria nuovi. Le feste tolte stanno nella tabella
    `promemoria_tolti`. Se il cliente cambia idea e chiede di riaverla, dal SQL Editor (al posto
    di `indirizzo@del.cliente` la sua email: maiuscole e spazi non contano; per l'anniversario
    `'Anniversario'` al posto di `'Compleanno'`):

    ```sql
    delete from public.promemoria_tolti
     where email = lower(trim('indirizzo@del.cliente')) and occasione = 'Compleanno'
    returning email, occasione, festa;
    ```

    Deve comparire la festa restituita (una riga per ogni festa tolta da quell'indirizzo per
    quell'occasione). Se non compare niente, l'indirizzo è scritto diverso da quello dell'ordine
    e non è cambiato niente. Vale dal prossimo ordine per quella festa, anche se poi si rilancia
    la migrazione;
  - lo staff, dal gestionale: «Non mandare questa» (una sola mail) o «Togli questa ricorrenza»
    (le mail in arrivo di quella festa, compreso un eventuale secondo ordine per la stessa festa).
    Quella dello staff vale per l'anno in corso e si annulla con «Rimetti in coda»; per toglierla
    anche negli anni dopo deve essere il cliente a usare il link nella mail.
  Una festa tolta dal cliente non si può rimettere in coda dal gestionale.
- **Disiscrizione da tutto**: dal link «Non voglio più nessun promemoria», oppure dallo staff nella
  sezione **Disiscritti** del gestionale. Vale per l'indirizzo email, anche sugli ordini futuri. Si
  può **riattivare** dalla stessa sezione, solo se è il cliente a chiederlo.
- **Esito degli invii**: il gestionale mostra cosa ha risposto EmailJS, entro una decina di minuti
  e a qualunque ora (anche dopo un «Invia ora» del pomeriggio); finché la risposta non è letta, sulla
  mail c'è scritto «Risposta di EmailJS in arrivo» (ricarica la scheda dopo qualche minuto). Se
  EmailJS è occupato (troppe richieste) la mail viene riprovata da sola al giro successivo fra le 9
  e le 12, fino a 3 volte: in quel caso non era partita. Se la risposta è incerta (errore del server
  di EmailJS, rete lenta) **non** si riprova da sola, per non rischiare una mail doppia: lo staff
  vede «esito incerto». Se EmailJS rifiuta la mail (template sbagliato, chiavi…) la mail risulta
  «errore»: va sistemato il problema e poi «Rimetti in coda». Le copie di **Prova** non vanno nella
  coda: se non arrivano, controlla il template su EmailJS.
- **Il giro** passa ogni 2 minuti fra le 7 e le 12 UTC; spedisce solo fra le 9 e le 12 italiane, una
  mail per volta (EmailJS accetta una richiesta al secondo). Un secondo lavoro, ogni 10 minuti per
  tutto il giorno (ai minuti 5, 15, 25…, così non si sovrappone mai al giro), legge soltanto le
  risposte di EmailJS (pg_net le tiene 6 ore). Il piano gratuito di EmailJS ha **200 mail al mese**
  in tutto, conferme d'ordine comprese: nei mesi di punta conviene controllarlo nel pannello di
  EmailJS.
- **Foto nella mail: possibile.** Dal 26/07/2026 le foto delle torte vengono salvate nello spazio
  file di Supabase (bucket `torte`) e hanno un indirizzo web vero. Il template attuale non la usa:
  per aggiungerla servono una riga `<img src="{{foto}}">` nel template e il parametro `foto` nella
  funzione di invio. Vale solo per gli ordini dal 26/07/2026 in poi.
- **Il primo promemoria vero parte a fine giugno 2027**: valgono solo gli ordini nuovi, quelli già
  in archivio non sono stati inclusi.
