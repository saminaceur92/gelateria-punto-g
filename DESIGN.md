---
name: Punto Gi! — L'Etichetta (/v2)
description: La homepage come etichetta alimentare italiana d'autore — la trasparenza è l'estetica.
colors:
  mare: "#2c7699"
  fondale: "#235f7d"
  azzurro: "#7cb7d7"
  legno: "#c0894c"
  legno-hover: "#d09a5f"
  legno-chiaro: "#e5c9a3"
  azzurrino: "#d8eaf3"
  cielo: "#eaf4f9"
  panna-etichetta: "#fdfaf2"
  carta: "#f1e9da"
  ink: "#32281f"
  ink-soft: "#6b5c4c"
  bianco-puro: "#ffffff"
  filetto: "rgba(50, 40, 31, 0.16)"
  filetto-forte: "rgba(50, 40, 31, 0.85)"
  filetto-chiaro: "rgba(255, 253, 246, 0.25)"
  filetto-chiaro-medio: "rgba(255, 253, 246, 0.35)"
  filetto-chiaro-forte: "rgba(255, 253, 246, 0.5)"
  filetto-bianco: "rgba(255, 255, 255, 0.4)"
  tinta-mare-08: "rgba(44, 118, 153, 0.08)"
  tinta-mare-12: "rgba(44, 118, 153, 0.12)"
  tinta-mare-16: "rgba(44, 118, 153, 0.16)"
  ombra-inchiostro-35: "rgba(15, 36, 48, 0.35)"
  ombra-inchiostro-40: "rgba(15, 36, 48, 0.4)"
  ombra-inchiostro-50: "rgba(15, 36, 48, 0.5)"
  ombra-inchiostro-60: "rgba(15, 36, 48, 0.6)"
typography:
  scale:
    mono-1: "0.58rem"
    mono-2: "0.6rem"
    mono-3: "0.62rem"
    mono-4: "0.66rem"
    mono-5: "0.68rem"
    mono-6: "0.7rem"
    mono-7: "0.72rem"
    mono-8: "0.78rem"
    mono-9: "0.8rem"
    ui-1: "0.82rem"
    ui-2: "0.85rem"
    ui-3: "0.92rem"
    ui-4: "0.95rem"
    ui-5: "0.98rem"
    body: "1rem"
    title-1: "1.05rem"
    title-2: "1.15rem"
    lead: "1.16rem"
    script-1: "1.3rem"
    script-2: "1.35rem"
    title-3: "1.45rem"
    data: "1.5rem"
    title-4: "1.6rem"
    script-3: "1.7rem"
    h2-min: "2rem"
    display-min-mobile: "2.5rem"
    menu-mobile-max: "2.6rem"
    display-min: "2.7rem"
    display-mobile-max: "3.4rem"
    display-max: "6rem"
    svg-ring: "7.5px"
    svg-abbr: "20px"
  display:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.7rem, 7.2vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 78 (font-stretch 78%), uppercase; mobile ≤560px: clamp(2.5rem, 12vw, 3.4rem); mobile menu: clamp(1.7rem, 7vw, 2.6rem)"
  headline:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2rem, 4.6vw, 3.4rem)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' ~78–88, uppercase"
  title:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 900
    lineHeight: 0.95
    fontVariation: "'wdth' 80, uppercase; sibling steps 1.05 / 1.15 / 1.6rem"
  lead:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.16rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Archivo, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    fontVariation: "condensed uppercase UI tier; shipped steps 0.8 / 0.82 / 0.85 / 0.92 / 0.95 / 0.98rem"
  label:
    fontFamily: "'Kode Mono', 'Courier New', monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.14em"
    fontVariation: "uppercase; micro ramp 0.58 / 0.6 / 0.62 / 0.66 / 0.68 / 0.7 / 0.72 / 0.78 / 0.8rem"
  data-value:
    fontFamily: "'Kode Mono', 'Courier New', monospace"
    fontSize: "1.5rem"
    fontWeight: 700
    fontVariation: "tabular-nums; steps 0.95 (mobile) / 1.15 / 1.5rem"
  script:
    fontFamily: "Caveat, cursive"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1.1
    fontVariation: "annotation steps 1.3 / 1.35 / 1.7rem"
rounded:
  r-focus: "2px"
  r-micro: "3px"
  r-stamp: "4px"
  r: "6px"
  r-big: "14px"
  r-pill: "99px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "16px"
  s4: "24px"
  s5: "40px"
  s6: "64px"
  s7: "104px"
components:
  button-primary:
    backgroundColor: "{colors.mare}"
    textColor: "{colors.bianco-puro}"
    rounded: "{rounded.r}"
    padding: "14px 26px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.fondale}"
    textColor: "{colors.bianco-puro}"
  button-accent:
    backgroundColor: "{colors.legno}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "14px 26px"
    height: "52px"
  button-accent-hover:
    backgroundColor: "{colors.legno-hover}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "14px 26px"
    height: "52px"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panna-etichetta}"
  button-ghost-inverse:
    backgroundColor: "transparent"
    textColor: "{colors.panna-etichetta}"
    rounded: "{rounded.r}"
    padding: "14px 26px"
    height: "52px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "10px 18px"
    height: "44px"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panna-etichetta}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.mare}"
    rounded: "{rounded.r-pill}"
    padding: "9px 16px"
    height: "44px"
  chip-hover:
    backgroundColor: "{colors.mare}"
    textColor: "{colors.bianco-puro}"
  sheet:
    backgroundColor: "{colors.panna-etichetta}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r-big}"
    padding: "clamp(1.4rem, 3.6vw, 3rem)"
  stamp:
    backgroundColor: "{colors.panna-etichetta}"
    textColor: "{colors.mare}"
    rounded: "{rounded.r-stamp}"
    padding: "10px 18px"
---

# Design System: Punto Gi! — L'Etichetta (/v2)

> **SCOPE — read this first.** This system governs ONLY the `/v2` surface: `src/pages/HomeV2.jsx` and `src/styles/v2.css` (everything scoped under `.v2`). The incumbent homepage on `/` (`src/App.jsx`, `src/components/*`, `src/styles/global.css` — the cream/Fraunces system) is a separate world and is NOT governed by this file until the user promotes /v2. Never restyle the v1 with v2 rules, and never let v1's serif/pastel language leak into /v2.

## Overview

**Creative North Star: "L'Etichetta"**

The homepage is an Italian food label made by an author's hand: the transparency the shop actually practices — live flavors, real allergen data, real production numbers, real opening hours — IS the aesthetic. Every surface behaves like printed label matter: cream label sheets with hairline rules (filetti), data tables, round certification marks, rubber stamps, a decorative barcode and a real QR code, all laid on the shop's own light-blue field. The world explicitly rejects the gelateria category default (cream + cursive serif + soft pastels — that's the v1) and its opposite (dark chocolate luxury).

The palette is the physical shop's, confirmed by the owners (2026-08-09): deep sea-blue bands and actions, wood/caramel warmth, cream label paper, dark-brown ink. The old Canva violet is no longer a brand color. Density is high but ordered: one rigorous grid, one label anatomy repeated everywhere, a rigid token scale with no off-scale values.

**Key Characteristics:**
- Label-sheet surfaces (cream + 1.5px filetto + one ambient shadow) on a dotted light-blue field
- Print grammar: filetti, tables, bordered data cells, stamps, round SVG marks, barcode, QR
- Three type voices: Archivo (speaks), Kode Mono (certifies data), Caveat (hand annotations)
- One orchestrated motion moment (the hero stamp); everything else is quiet feedback
- Real data as ornament: numbers, dates, hours, allergen marks are the decoration

## Colors

The shop's own walls translated to print: deep blue authority, wood warmth, cream paper, brown ink.

### Primary
- **Mare — deep sea blue** (`mare`): section bands, primary buttons, stamps, data values, focus rings, accents in headlines. The voice of authority on the label.
- **Fondale — deep-water blue** (`fondale`): footer, topline strip, mobile menu field, primary-button hover. The darkest structural blue.
- **Azzurro — bright shop blue** (`azzurro`): details on dark fields, `::selection` background, scrollbar thumb.

### Secondary
- **Legno — wood/caramel** (`legno`): the warm action color on cream — accent buttons, WhatsApp FAB, brand dot, hover underlines, "firma" tags.
- **Legno hover** (`legno-hover`): the single lightened hover state of legno (accent buttons, FAB).
- **Legno chiaro — light wood** (`legno-chiaro`): the legible warm accent on dark blue surfaces (tape icons, "OGGI" badge, footer heart).

### Neutral
- **Azzurrino — shop light blue** (`azzurrino`): the page field, always with the 22px dotted-grid radial texture (dots in `tinta-mare-12`).
- **Cielo — sky** (`cielo`): secondary text and focus rings on dark blue (AA 4.5:1).
- **Panna etichetta — label cream** (`panna-etichetta`): the label paper; every sheet, the nav, stamps, captions.
- **Carta — aged paper** (`carta`): secondary paper — photo-window backing, hover fills, zebra.
- **Ink — testa di moro** (`ink`): the ink; all primary text, strong borders (2px), tab-active fill.
- **Ink soft** (`ink-soft`): secondary text on label surfaces, mono legends.
- **Bianco puro** (`bianco-puro`): pure white, used only as text/fill on saturated blue (primary buttons, today-row, firma row, chip hover, in-sheet selection) and as the brand-logo circle backing.
- **Filetto / Filetto forte** (`filetto`, `filetto-forte`): 1.5px hairline rules and 3px strong rules — the skeleton of every table and section head.

### Tints & Inks (utility values, shipped)
- **Light hairlines on dark** (`filetto-chiaro` 0.25 / `filetto-chiaro-medio` 0.35 / `filetto-chiaro-forte` 0.5, all `rgba(255, 253, 246, …)`): footer dividers, tape borders and social-button borders on fondale/mare bands; `filetto-bianco` (`rgba(255, 255, 255, 0.4)`) is the leader-line filetto inside the white-on-mare firma row.
- **Mare tints** (`tinta-mare-08/12/16`): hover wash on servizio rows (0.08), the page-field dot texture (0.12), the scrollbar track (0.16).
- **Ink-blue shadow ink** (`ombra-inchiostro-35/40/50/60`, all `rgba(15, 36, 48, …)`): the only shadow color, at four opacities — sheet ambient (0.35), annotation (0.4), scrolled nav (0.5), FAB (0.6). Never used as a text or fill color.

### Named Rules
**The Shop-Wall Rule.** The palette is the physical shop's (blue + wood + cream + brown ink), confirmed by the owners. Never reintroduce the old Canva violet as a brand color: `#b651e4` survives ONLY as the flavor-swatch data color of the signature gusto "Punto Gi" — data, not brand.
**The Content-Color Rule.** Flavor and product data colors (`#b651e4` Punto Gi, `#7ea15a` pistacchio, `#2a160e` cioccolato fondente, and every swatch mirrored from the live catalog) are CONTENT, not palette. They appear only inside data components (flavor chips, cake-preview demo) and never migrate into UI, backgrounds or type.
**The Ink-on-Paper Rule.** On cream, text is ink (`ink`/`ink-soft`), structure is filetto, and color (mare/legno) is reserved for actions, data values and stamps. On blue fields, text is cream/cielo and the warm accent switches to `legno-chiaro`.

## Typography

**Display Font:** Archivo variable, wdth 62–125, wght 100–900 (with Helvetica Neue, Arial)
**Body Font:** Archivo (same family, normal width)
**Label/Mono Font:** Kode Mono 400–700 (with Courier New) — all data, codes, hours, legends, captions
**Script Font:** Caveat — hand-written annotations only (inherited brand asset)

**Character:** One variable family compressed for shouting and relaxed for reading, certified by a technical mono, humanized by a handwritten note. Condensed 900 uppercase display against tiny tracked-out mono labels is the signature contrast.

### Hierarchy
- **Display** (900, `clamp(2.7rem, 7.2vw, 6rem)`, lh 0.9, font-stretch ~78%, uppercase, tracking -0.015em): the hero H1 only. Mobile ≤560px: `clamp(2.5rem, 12vw, 3.4rem)`; the mobile menu uses its own display step `clamp(1.7rem, 7vw, 2.6rem)`.
- **Headline** (900, `clamp(2rem, 4.6vw, 3.4rem)`, lh 0.95): section heads inside the `v2-head` anatomy.
- **Title** (900 condensed uppercase): 1.45rem service rows/sub-blocks, with fixed siblings 1.6rem (facts title), 1.15rem (brand), 1.05rem (dove column heads).
- **Lead** (400, 1.16rem, lh 1.6, color ink-soft): intro paragraphs, "ingredienti" lines; max ~58ch.
- **Body** (400, 1rem, lh 1.55): default; paragraphs max 68ch. Hours-table body at 0.92rem.
- **UI** (Archivo 700–800 condensed uppercase): the interface tier — shipped steps 0.8 (nav links, small buttons, hours values), 0.82 (spec strong, mobile stamp), 0.85 (tabs, chips, small text, allergeni link, fact-value small), 0.95 (buttons; mobile cell values), 0.98rem (flavor names, fact labels).
- **Label / Campo** (Kode Mono 600, tracking 0.1–0.32em, uppercase): the `v2-campo` voice. The shipped micro ramp, smallest to largest: 0.58 (cell labels, OGGI badge), 0.6 (diet marks, figcaptions, firma tag, brand small), 0.62 (photo/spec/info captions), 0.66 (stamp date, facts note, footer bottom), 0.68 (topline, tab count, QR note), 0.7 (mobile-menu index), 0.72 (`--v2-t-dato`, footer links), 0.78 (tape), 0.8rem (hours values). Every micro-label on a new surface picks from this ramp.
- **Data values** (Kode Mono 700, tabular-nums, usually mare): 1.5rem (facts), 1.15rem (data cells; 0.95rem at ≤560px).
- **Script** (Caveat): 1.35rem photo annotations, 1.3rem mobile fallback list, 1.7rem margin notes.
- **SVG graphic text** (not page text): 7.5px mono for the CertMark textPath ring and barcode digits; 20px Archivo 900 for the CertMark abbreviation. These live inside fixed-size SVG graphics and never appear in flowing copy.

### Named Rules
**The Three Voices Rule.** Archivo speaks, Kode Mono certifies, Caveat annotates. No fourth voice, and the voices never swap jobs: data and codes are never set in Archivo; headlines are never set in mono or script.
**The Tabular Data Rule.** Every number that measures something (counters, facts, hours, cells) is Kode Mono with `font-variant-numeric: tabular-nums`, usually in `mare`.
**The Ramp-Not-Whim Rule.** The micro sizes are a ramp, not free values: pick the nearest shipped step (see the UI and Label tiers above) instead of inventing a new size between them.

## Layout

One container: max-width 1240px, `padding-inline: clamp(1rem, 3.5vw, 2.5rem)` (`v2-wrap`). Sections are label sheets (`v2-sheet` + `v2-section-sheet` padding `clamp(1.4rem, 3.6vw, 3rem)`) floating on the dotted blue field, separated by `s6` (64px) vertical rhythm; the gallery closes with `s7` (104px).

Spacing is a rigid seven-step scale — 4 / 8 / 16 / 24 / 40 / 64 / 104 (`s1–s7`) — with no off-scale values. Internal grids are asymmetric two-column (7/5 hero, 5/6 ricetta, 6/5 torta, 5/4/5 dove) with `clamp(1.5rem, 4vw, 3.5rem)` gutters.

Responsive collapse is by priority, at 1080 / 900 / 720 / 560px: nav links become a full-screen menu at 1080; grids stack at 900 (hero re-orders via named grid areas: lead → visual → ctas → cells → ingredienti → marks); photo annotations swap to a plain fallback list at 900; CTAs go full-width and spec cells stack at 560. Touch targets are ≥44px throughout.

## Elevation & Depth

Depth is print-flat with one ambient lift: label sheets sit on the field with a single soft shadow; everything inside a sheet is flat and drawn with borders, not shadows. The stamp presses INTO the paper via `mix-blend-mode: multiply` instead of lifting off it.

### Shadow Vocabulary
- **Sheet ambient** (`box-shadow: 0 20px 50px -26px rgba(15, 36, 48, 0.35)` = `--v2-shadow`): the only resting shadow; label sheets, facts panel, gallery shots, tilted photo.
- **Nav scrolled** (`0 14px 40px -18px rgba(15, 36, 48, 0.5)`): appears on the sticky nav only after scroll.
- **FAB** (`0 14px 34px -12px rgba(15, 36, 48, 0.6)`): the floating WhatsApp button.
- **Annotation** (`3px 4px 12px -6px rgba(15, 36, 48, 0.4)`): the small Caveat call-out cards over the hero photo.

### Named Rules
**The One Shadow Rule.** Inside a sheet, hierarchy is made with filetti, borders and fills — never with additional shadows. All shadows share the same blue-black `rgba(15, 36, 48, …)` ink at four opacities (0.35 / 0.4 / 0.5 / 0.6).

## Shapes

Print corners, never blobs, in two tiers. **Sheet tier:** 6px (`r`) on buttons, tabs, cells, icon boxes; 14px (`r-big`) on sheets, photo windows, map. **Print-detail tier:** 2px (`r-focus` — the focus-visible ring corner), 3px (`r-micro` — diet marks, count badges, firma/OGGI tags, inner photo corners, flavor-row hover), 4px (`r-stamp` — stamps, photo captions, QR corner, today-row end caps). Pills are 99px (`r-pill`: chips, scrollbar thumb/track). The only circles are things that are circular in the real print world: certification marks, the brand logo ring, flavor swatches, the "go" arrow ring, the FAB.

Borders do the drawing: 2px ink frames on photo windows, data cells, tabs, icon boxes; 1.5px filetto hairlines on rows and dividers; 3px `filetto-forte` on section-head baselines; dotted 1.5px filetti as menu leader lines. Slight rotations are part of the grammar: stamps -7°/+6°, tilted photo +2.5°, gallery shots alternating ±1.1°.

Ornament is an authored SVG program in the world's stroke (stroke 2, round caps): OrnCono, OrnCoppetta, OrnGocciaNo, OrnTorta, sitting in 2px-ink bordered boxes; Lucide icons at the same stroke fill in only where no product ornament exists.

## Components

### Buttons
- **Character:** stamped label actions — condensed 800 uppercase, tracking 0.07em, never soft.
- **Shape:** print corner (6px), min-height 52px (44px in nav), padding 14px 26px.
- **Primary:** mare with pure-white text; hover deepens to fondale.
- **Accent (warm action):** legno with ink text; hover lightens to `legno-hover`. Used for "Crea la tua torta" and WhatsApp actions.
- **Ghost / Ghost-inverse:** transparent with 2px border in ink (or cream on dark); hover inverts to solid.
- **States:** all transitions 0.2s on the house ease; `:active` presses down 1px (`translateY(1px)`).

### Chips
- **Style:** 99px pill, 2px mare border, mare text, transparent fill, min-height 44px.
- **State:** hover/selected inverts to solid mare with white text. Diet marks (SL/VEG/SG) are the tiny square cousins: mono 0.6rem, 1.5px `ink-soft` border, 3px radius.

### Cards / Containers (Foglio etichetta)
- **Corner Style:** 14px.
- **Background:** `panna-etichetta` with `ink` text; secondary paper `carta` behind photos.
- **Border:** 1.5px filetto; **Shadow:** the single sheet ambient.
- **Section head anatomy (`v2-head`, unique and mandatory):** baseline-aligned row of headline + `v2-campo` field label, closed by a 3px `filetto-forte` rule, `s3` below, `s4` before the body. Every section on a sheet uses exactly this anatomy.

### Tabs (Carta dei gusti)
- **Style:** 2px ink border, 6px radius, condensed 800 uppercase 0.85rem, min-height 44px, mono count badge in a 1.5px bordered box (3px radius).
- **States:** hover fills `carta`; active inverts to solid ink with cream text.

### Navigation
- Mono topline strip on `fondale`; sticky cream nav with a 3px ink bottom border; links are 700 condensed uppercase 0.8rem with a 2px transparent underline that turns `legno` on hover (text to mare). Shadow only after scroll. Mobile: full-screen `fondale` overlay, giant condensed 900 links (`clamp(1.7rem, 7vw, 2.6rem)`) with 0.7rem mono index numbers in `cielo`.

### Timbro (signature component)
- A rubber stamp: 2.5px `currentColor` border with a double-inset ring (`inset 0 0 0 1.5px` cream + `inset 0 0 0 3px` currentColor), 4px radius, 900 condensed uppercase, rotated -7°, `mix-blend-mode: multiply`, mono small line (0.66rem) for the date. The hero "FRESCO DI OGGI" stamp carries the real date and is the page's one orchestrated motion moment (spring, stiffness 300, damping 16, delay 1.1s after the hero fade).

### Data cells / Facts table
- Bordered 2px-ink grids of three cells; values in Kode Mono 700 `mare` tabular-nums (1.15rem, 0.95rem at ≤560px), labels in 0.58rem tracked mono `ink-soft`. The facts panel imitates a nutrition label: 8px ink bar under the subtitle, 1.5px filetti between rows, 4px ink bar closing. Counters count up once in view (1.8s, house ease, skipped under reduced motion).

### Marchi tondi (CertMark) & Barcode
- Round certification marks are fixed 88px SVGs: 2px ink outer ring, 1.5px inner ring, a 7.5px mono textPath ring in `ink-soft`, a 20px Archivo 900 abbreviation in `mare`, on a pure-white/cream backing. The barcode is decorative currentColor bars with 7.5px mono digits. Their SVG text sizes are graphic, not part of the page type ramp.

### Motion (system-wide)
- House ease `cubic-bezier(0.16, 1, 0.3, 1)`; feedback transitions 0.15–0.3s. One orchestrated moment only: the hero load choreography ending in the stamp. Marquee tape: 36s linear infinite on the mare band. **No whileInView entrance animations on sections** (removed on reviewer verdict). Everything guarded by `prefers-reduced-motion`.
- Browser surfaces are themed: `::selection` azzurro/ink (mare/white inside sheets), `:focus-visible` 3px mare with 2px corner (cielo on dark), thin azzurro scrollbar, `caret-color` mare.

## Do's and Don'ts

### Do:
- **Do** put every surface on a cream label sheet (panna + 1.5px filetto + 14px + the single ambient shadow) over the dotted azzurrino field.
- **Do** open every sheet section with the `v2-head` anatomy (headline + mono field label + 3px filetto-forte rule) — it is the only section-head pattern.
- **Do** set all data — numbers, dates, hours, codes, legends — in Kode Mono, tabular-nums, usually in mare.
- **Do** stay on the rigid scales: spacing 4/8/16/24/40/64/104; radii 6/14 with the print-detail tier 2/3/4px and 99px pills; the shipped micro type ramp; one ease `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Do** use the authored ornament program (OrnCono, OrnCoppetta, OrnGocciaNo, OrnTorta, stroke 2) before reaching for Lucide; keep any Lucide fill-in at stroke 2.
- **Do** keep touch targets ≥44px and respect `prefers-reduced-motion` on every animation.

### Don't:
- **Don't** reintroduce the Canva violet as brand color; `#b651e4` exists only as the "Punto Gi" flavor swatch datum — and no flavor/product data color (e.g. `#7ea15a`, `#2a160e`) ever becomes UI.
- **Don't** bring v1 language into /v2 (Fraunces/serif, soft pastels, blob shapes) — and don't apply this file to the v1 on `/`.
- **Don't** add entrance animations to sections or scattered hover theatrics: one orchestrated moment (the hero stamp), quiet feedback everywhere else.
- **Don't** add new shadows inside sheets; draw hierarchy with filetti, borders and fills — and never shadow in any color other than the `rgba(15, 36, 48, …)` ink.
- **Don't** use emoji as icons, invent testimonials, or fake data — every number, hour and mark on the label must be real.
- **Don't** use round/blob corners on rectangular matter; circles are reserved for marks, swatches, ring buttons and the FAB.
