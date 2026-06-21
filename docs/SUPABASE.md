# 🗄️ Backend dati — Supabase

> **Decisione di progetto:** la gestione dei dati passa da **Airtable → Supabase**.
> Supabase è la fonte di verità per gusti, prezzi, contenuti modificabili dal cliente
> e (Fase 2) per lo **storico ordini**.

## 📌 Progetto

| Campo | Valore |
|---|---|
| Project ref | `bqmoxdeagqpzvcblpcbm` |
| Dashboard | https://supabase.com/dashboard/project/bqmoxdeagqpzvcblpcbm |
| MCP endpoint | `https://mcp.supabase.com/mcp?project_ref=bqmoxdeagqpzvcblpcbm` |

A cosa serve:
- **Gusti / prezzi / contenuti** → la gelateria li modifica da sola (sostituisce Airtable)
- **Storico ordini** (Fase 2) → ogni ordine ricevuto viene salvato e consultabile

---

## 🤖 MCP Supabase per gli AI tool (Claude Code)

Il server MCP di Supabase permette agli strumenti AI di leggere/operare sul progetto
(tabelle, query, ecc.) direttamente da Claude Code.

### 1. Aggiungere il server MCP

Configurato a livello di progetto (scrive in `.mcp.json` nella root del repo):

```bash
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=bqmoxdeagqpzvcblpcbm"
```

### 2. Autenticarsi

⚠️ Va fatto in un **terminale normale, NON dentro l'estensione IDE**:

```bash
claude /mcp
```

Poi: seleziona il server **supabase** → **Authenticate** → completa il flow OAuth nel browser.

### 3. (Opzionale) Agent Skills per Supabase

Istruzioni/script pronti che aiutano gli AI tool a lavorare con Supabase in modo più preciso:

```bash
npx skills add supabase/agent-skills
```

---

## 🔐 Note & sicurezza

- L'autenticazione MCP è **OAuth**: i token NON finiscono nel repo, restano nella config locale di Claude.
- `.mcp.json` contiene solo l'URL con il `project_ref` (non è un segreto), quindi può stare nel repo.
- Le **chiavi Supabase** (anon key, service_role) e le credenziali DB vanno in **variabili d'ambiente**
  (`.env` locale + env di Vercel), **mai committate**. Solo la `anon key` può stare lato client;
  la `service_role` resta esclusivamente server-side.
- Ogni sviluppatore deve rifare il punto **2 (Authenticate)** sulla propria macchina.
