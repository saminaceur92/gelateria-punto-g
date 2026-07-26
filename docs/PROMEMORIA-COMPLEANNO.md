# Promemoria compleanno — come si attiva

Chi ordina una torta scegliendo **occasione "Compleanno"** e lascia l'email riceve, l'anno
successivo, **due mail**: 30 e 14 giorni prima dell'anniversario della data di ritiro. Dentro c'è
la torta di allora e il link per rifarla con un clic.

Tutto gira su Supabase (nessun server nuovo): un trigger mette i promemoria in coda quando l'ordine
viene creato, un job `pg_cron` giornaliero li spedisce via EmailJS con `pg_net` — la stessa tecnica
già usata per le notifiche Telegram.

---

## 1. Esegui la migrazione

Dal **SQL Editor** di Supabase, il contenuto di
`migrations/2026-07-26-promemoria-compleanno.sql`.

Crea: la coda (`promemoria_compleanno`), la lista dei disiscritti (`promemoria_stop`), il trigger
sugli ordini, la funzione di invio, il job giornaliero delle 07:30 UTC e le funzioni usate dal sito.

Finché non ci sono le chiavi EmailJS (passo 3) **non parte nessuna mail**: la coda si riempie e
basta, non si perde niente.

## 2. Crea il template su EmailJS

Su [emailjs.com](https://dashboard.emailjs.com/) → **Email Templates** → *Create New Template*.
Parte dal modello "Contact Us": va svuotato e riempito così.

**Riquadro a destra:**

| Campo | Valore |
|---|---|
| To Email | `{{email}}` |
| From Name | `Gelateria Punto Gi!` |
| From Email | lasciare *Use Default Email Address* |
| Reply To | **vuoto** (se resta `{{email}}` le risposte tornano al cliente) |
| Bcc / Cc | vuoti |

**Subject:** `{{cliente}}, il compleanno si avvicina! 🎂`

**Content** (bottone *Edit Content* → cancellare tutto e incollare):

```html
<div style="font-family: Arial, Helvetica, sans-serif; color:#33291f; font-size:15px; line-height:1.6;">
  <p>Ciao {{cliente}}! 🎂</p>
  <p>Un anno fa, il {{anno_scorso}}, hai festeggiato con una torta fatta da noi:<br>
     <strong>{{torta}}</strong></p>
  <p>Il compleanno si avvicina di nuovo (<strong>{{quando}}</strong>): ti va di rifarla?</p>
  <p style="margin:28px 0;">
    <a href="{{link_torta}}" style="background:#2c7699;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:bold;display:inline-block;">Rifai questa torta</a>
  </p>
  <p style="color:#6b6b7b;font-size:13px;">È già pronta come l'anno scorso: devi solo scegliere il giorno e confermare. Per le torte servono almeno 5 ore di preavviso.</p>
  <p>Ti aspettiamo!<br><strong>Gelateria Punto Gi!</strong> — Via Remesina Interna 46, Carpi (MO)</p>
  <hr style="border:none;border-top:1px solid #e6e0d4;margin:24px 0;">
  <p style="color:#8a8073;font-size:12px;">
    Ricevi questa mail perché un anno fa hai ordinato da noi una torta di compleanno.
    <a href="{{link_stop}}" style="color:#8a8073;">Non voglio più questi promemoria</a>
  </p>
</div>
```

⚠️ Non devono restare `{{name}}`, `{{title}}`, `{{message}}`, `{{time}}`: sono le variabili del
modello di esempio, il database non le manda e lascerebbero righe vuote.

Dopo **Save**: scheda **Settings** del template → nome "Promemoria compleanno" e **copia il
Template ID** (es. `template_ab12cde`). È quello che va in `app_config` al passo 3.

Variabili che il database invia:

| Variabile | Contiene | Esempio |
|---|---|---|
| `{{cliente}}` | nome di battesimo | `Giulia` |
| `{{torta}}` | la torta dell'anno scorso | `Semifreddo — Pistacchio, Bacio` |
| `{{quando}}` | data dell'anniversario | `15/08/2027` |
| `{{anno_scorso}}` | data del ritiro di allora | `15/08/2026` |
| `{{link_torta}}` | link "rifai questa torta" | apre il configuratore già compilato |
| `{{link_stop}}` | link di disiscrizione | **obbligatorio, va sempre messo** |

Esempio di testo:

> Ciao {{cliente}}! 🎂
>
> Un anno fa, il {{anno_scorso}}, hai festeggiato con una **{{torta}}** fatta da noi.
> Il compleanno si avvicina di nuovo ({{quando}}): ti va di rifarla?
>
> 👉 **[Rifai questa torta]({{link_torta}})** — è già pronta, devi solo confermare
>
> Ti aspettiamo! — Gelateria Punto Gi!, Carpi
>
> ---
> *Non vuoi più questi promemoria? [Disiscriviti qui]({{link_stop}}) (un clic, niente moduli).*

## 3. Abilita l'invio da server e salva le chiavi

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
  ('site_url',                    'https://gelateria-punto-g.vercel.app')
on conflict (key) do update set value = excluded.value;
```

(`template_1jgkt0l` è il template "Promemoria compleanno" creato il 26/07/2026; l'unica cosa
ancora da sostituire è `LA_TUA_PRIVATE_KEY`.)

⚠️ Quando collegherai il dominio definitivo, aggiorna `site_url`: è la base dei link dentro le mail.

## 4. Prova che funzioni

Nel gestionale c'è la scheda **🎂 Promemoria**. Fai un ordine di prova con occasione "Compleanno"
e la tua email: comparirà in coda con la data del prossimo anno. Il bottone **"Invia ora"**
anticipa l'invio a oggi e lo spedisce davvero, così puoi vedere la mail senza aspettare un anno.

> Nota: l'invio salta chi ha ordinato negli ultimi 60 giorni (inutile ricordare il compleanno a
> chi ha appena prenotato). Se la prova non parte per questo, usa un'email diversa da quella
> dell'ordine appena fatto.

---

## Cose da sapere

- **Doppio invio, non di più**: 30 giorni prima e 14 giorni prima. Il secondo salta in automatico
  se nel frattempo il cliente ha ordinato.
- **Disiscrizione permanente**: vale per l'indirizzo email, anche sugli ordini futuri.
- **Foto nella mail: ora è possibile.** Dal 26/07/2026 le foto delle torte vengono salvate nello
  spazio file di Supabase (bucket `torte`) e hanno un indirizzo web vero, quindi si possono
  mostrare anche nelle mail. Il template attuale non la usa: per aggiungerla servono una riga
  `<img src="{{foto}}">` nel template e il parametro `foto` nella funzione di invio. Vale solo per
  gli ordini dal 26/07/2026 in poi (i precedenti hanno l'immagine "incollata dentro" al database,
  che i programmi di posta non mostrano).
- **Il primo promemoria vero parte tra un anno**: valgono solo gli ordini nuovi, quelli già in
  archivio non sono stati inclusi.
