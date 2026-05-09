# Gelateria Punto G! – Sito ufficiale

Sito vetrina per la **Gelateria Punto G!** di Carpi (MO).
Realizzato con **Vite + React + Framer Motion**, pronto per il deploy su **Vercel**.

> *"Il gelato che ti emoziona."*

## 🚀 Sviluppo locale

```bash
npm install
npm run dev
```

Apri http://localhost:5173

## 🏗️ Build di produzione

```bash
npm run build
npm run preview
```

L'output finisce in `dist/`.

## ☁️ Deploy su Vercel

1. Pusha il repo su GitHub.
2. Su [vercel.com](https://vercel.com) → **New Project** → seleziona il repo.
3. Vercel rileva automaticamente Vite. Build command `npm run build`, output `dist`.
4. Deploy 🎉

## 🎨 Palette (estratta dal Canva ufficiale)

| Colore | Hex | Uso |
|---|---|---|
| Crema | `#fff9ed` | Sfondo principale |
| Pesca | `#faeae1` | Sezione menu |
| Salvia | `#a5cdcb` | Accento |
| Viola brillante | `#b651e4` | Accento primario |
| Viola profondo | `#602e9e` | Brand / CTA |
| Arancio | `#eb911e` | Pallino del logo / accenti caldi |
| Inchiostro | `#2a1a3e` | Testo & sezioni scure |

## 📁 Struttura

```
src/
  ├─ App.jsx
  ├─ main.jsx
  ├─ components/    → Navbar, Hero, About, Services, Menu, Gallery, Contact, Footer, ...
  ├─ data/flavors.js → Catalogo gusti
  └─ styles/global.css → Design system completo
public/
  ├─ logo.png
  ├─ favicon.svg
  └─ *.jpg          → immagini hero/gallery
```

## 🛒 Roadmap

- [x] Sito vetrina (v1)
- [ ] E-commerce: ordini online + pagamento (Stripe)
- [ ] Calendario prenotazione torte
- [ ] Newsletter gusti del mese

## 📞 Contatti gelateria

- 📍 Via Remesina Interna 46, 41012 Carpi (MO)
- 📱 WhatsApp: [320 330 6009](https://api.whatsapp.com/send?phone=393203306009)
- 📷 [@gelateriapuntogicarpi](https://www.instagram.com/gelateriapuntogicarpi/)
