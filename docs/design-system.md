# Lacertosus Office OS — Design System (Fondamenta)

> Sistema di riferimento per tutta la UI. Solo light mode nell'MVP.
> Implementazione: token in `app/globals.css` (Tailwind v4 `@theme`),
> preset motion in `lib/motion.ts`, componenti base in `components/ui/`.
> Ogni nuovo componente deriva da questi token: niente valori hardcoded.

## 0. Identità

**Soggetto.** Strumento operativo quotidiano dell'ufficio marketing ed
e-commerce di Lacertosus, azienda italiana di attrezzatura per lo strength
training: acciaio, ghisa, verniciatura a polvere. La UI prende da lì il suo
carattere: una **sala di esposizione bianca** in cui gli oggetti (task) sono
pezzi ben lavorati, il testo è **grafite** come l'attrezzatura, e l'**arancio
Lacertosus** compare solo dove si agisce o dove serve attenzione — come la
verniciatura d'accento sui prodotti.

**Colore di marca verificato.** L'arancio è **`#F09226`**, estratto dal CSS di
produzione di lacertosus.com (101 occorrenze; `.btn-primary` del sito:
sfondo `#f09226`, testo scuro `#2d2d2d`). Il bianco su questo arancio ha
contrasto 2.4:1 — per questo, come già fa il sito, **i bottoni primari usano
testo grafite su arancio** (6.4:1, AA).

**Firma visiva.** Due elementi rendono riconoscibile il sistema:

1. **La tacca di stato** — lo stato del task non è un chip colorato ma un
   piccolo indicatore circolare "lavorato a macchina" che si riempie come una
   ghiera: tratteggiato (Backlog) → anello vuoto (Da fare) → mezzo pieno
   (In corso) → anello arancio con punto (In revisione) → pieno verde con
   spunta (Fatto). Il riempimento codifica il progresso reale del flusso:
   la struttura è informazione, non decorazione.
2. **Dati in mono** — date, contatori, ID e scorciatoie sono sempre in
   IBM Plex Mono: la voce "registro di officina" che separa i dati dal testo.

**La disciplina del colore.** Superfici bianche, testo grafite, e solo due
momenti di croma nell'intero sistema: **arancio** (azione primaria, evidenza,
stato In revisione) e **verde** (completamento). Nessun altro colore compare
nel flusso quotidiano; rosso/giallo/blu esistono solo come semantici di
errore/avviso/info nei form e nei toast.

## 1. Token colore

Formato: hex (implementati come oklch in `globals.css`). I nomi tra
parentesi sono i token Tailwind/shadcn corrispondenti.

### Superfici

| Token | Valore | Uso |
|---|---|---|
| `canvas` (`background`) | `#F7F7F8` | Sfondo dell'app dietro le superfici |
| `surface` (`card`, `popover`) | `#FFFFFF` | Card, sidebar, pannelli, menu, board column? no: colonne su canvas |
| `surface-hover` (`accent`) | `#F2F2F4` | Hover di righe, voci di menu |
| `muted` | `#F1F1F3` | Riempimenti neutri, skeleton, bottone secondary |
| `selected` | `#FDF6EC` (brand-50) | Riga/elemento selezionato, evidenza calma |
| `scrim` | `#17181C` al 32% | Velo dietro pannello laterale e dialoghi |

### Grafite (testo e bordi)

| Token | Valore | Contrasto su bianco | Uso |
|---|---|---|---|
| `ink` (`foreground`) | `#212327` | 15.9:1 | Titoli, testo primario, valori |
| `ink-secondary` | `#5A5E66` | 6.5:1 | Testo secondario, descrizioni |
| `ink-muted` (`muted-foreground`) | `#696E76` | 5.1:1 (4.8:1 su canvas) | Metadati, caption, icone inattive |
| `ink-faint` | `#9CA1A9` | 2.9:1 | Solo placeholder e decorazioni — mai informazione necessaria |
| `border-soft` | `#EEEFF1` | — | Divisori interni |
| `border` | `#E3E5E8` | — | Bordi di card e superfici |
| `border-strong` (`input`) | `#C9CDD3` | — | Bordi di input e controlli |

### Arancio Lacertosus (brand)

| Token | Valore | Uso |
|---|---|---|
| `brand-50` | `#FDF6EC` | Sfondo selezione/evidenza |
| `brand-100` | `#FAE9CF` | Sfondo evidenza più marcato |
| `brand-300` | `#F3B968` | Decorazioni, grafici futuri |
| `brand-500` (`primary`) | `#F09226` | **Riempimento azioni primarie** (testo `ink`, 6.4:1) |
| `brand-550` | `#E28110` | Hover del bottone primario |
| `brand-600` (`ring`) | `#D97706` | **Focus ring** (3.2:1 su bianco), tacca In revisione, icone attive |
| `brand-700` | `#B45309` | **Testo arancio su bianco** (5.0:1): link d'accento, etichetta In revisione |

Regola (da `CLAUDE.md`): l'arancio compare **solo** per azioni primarie,
evidenza e stato In revisione. Mai come colore di superfici estese, mai per
testo lungo, mai decorativo.

### Semantici

| Token | Fondo | Testo su bianco | Uso |
|---|---|---|---|
| `success` | `#16A34A` (soft `#EAF7EF`) | `#15803D` (5.0:1) | Conferme, stato Fatto |
| `danger` (`destructive`) | `#D92D20` (soft `#FDEBE9`) | `#B42318` (5.9:1) | Errori, azioni distruttive (testo bianco su `#D92D20`: 4.8:1) |
| `warning` | `#F5C33B` (soft `#FBF3D9`) | `#8A6A0B` (5.2:1) | Avvisi rari |
| `info` | `#2563EB` (soft `#EFF4FF`) | `#2563EB` (5.2:1) | Note informative rare |

### Stati del task (la tacca)

| Stato | Tacca | Colore tacca | Etichetta testo |
|---|---|---|---|
| `backlog` | anello tratteggiato | `#9CA1A9` | `ink-muted` |
| `todo` | anello vuoto | `#878D96` | `ink` |
| `in_progress` | mezzo pieno | `#212327` | `ink` |
| `in_review` | anello + punto | `#D97706` | `brand-700` |
| `done` | pieno + spunta | `#16A34A` | `#15803D` |

Il flusso resta monocromatico grafite; l'arancio marca l'unico stato che
chiede attenzione altrui, il verde chiude. Nessun chip colorato arcobaleno.

## 2. Tipografia

| Ruolo | Font | Perché |
|---|---|---|
| UI e titoli | **Archivo** (variabile) | Grotesca solida, "industriale" senza essere fredda; regge dai 12px ai titoli. Il sito e-commerce usa Bebas Neue per i display: qui sarebbe urlato — Archivo SemiBold con tracking stretto ne conserva la solidità in tono da ufficio. |
| Dati | **IBM Plex Mono** (400/500) | Date, numeri, contatori, ID, kbd. Cifre allineate, voce tecnica. |

Niente Inter/Geist di default: la coppia Archivo + Plex Mono è la scelta
specifica di questo prodotto.

### Scala (desktop; rem su base 16px)

| Token | Dimensione/interlinea | Peso | Tracking | Uso |
|---|---|---|---|---|
| `display` | 28/34 | 650 | −0.015em | Rari momenti hero (es. empty state pieno pagina) |
| `title-page` | 22/28 | 600 | −0.012em | Titolo di pagina nella topbar |
| `title-section` | 17/24 | 600 | −0.008em | Sezioni, intestazione pannello |
| `title-item` | 14/20 | 500 | −0.004em | Titoli di task/card, `ink` |
| `body` | 14/20 | 400 | 0 | Testo UI di default, `ink-secondary` per descrizioni |
| `body-lg` | 15/22 | 400 | 0 | Descrizione task nel pannello |
| `meta` | 13/18 | 400 | 0 | Metadati, `ink-muted` |
| `caption` | 12/16 | 400 | 0 | Didascalie, contatori di colonna |
| `overline` | 11/14 | 600 | +0.06em, maiuscolo | Intestazioni di colonna board, etichette di gruppo |
| `mono` | 13/18 | 400 | 0 | Date e numeri in linea |
| `mono-sm` | 12/16 | 400/500 | 0 | Badge dati, kbd, contatori |

Gerarchia con **peso e colore prima che con la dimensione**: un elenco usa
`title-item` (500, `ink`) sopra `meta` (400, `ink-muted`) — mai due grigi
uguali a pesi uguali. Massimo tre livelli tipografici visibili per vista.

## 3. Spaziatura e densità

- **Griglia 4px.** Scala: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Altezze controlli:** `sm` 32px · `md` 36px (default) · `lg` 40px (CTA).
- **Padding superfici:** card 16 · pannello laterale 24 · pagina 24 (desktop) / 16 (mobile).
- **Ritmo verticale liste:** righe da 44–48px; board card: padding 12, gap interni 8.
- **Icone:** 16px nei controlli, 18px in navigazione, stroke 1.75 (lucide).
- Densità unica su tutti i breakpoint (niente "modalità compatta" nell'MVP).

## 4. Raggi

| Token | Valore | Uso |
|---|---|---|
| `xs` | 4px | Checkbox, kbd, mini-badge |
| `sm` | 6px | Badge, input piccoli, tacca contenitore |
| `md` (default, `--radius`) | 8px | Bottoni, input, menu |
| `lg` | 12px | Card, pannello laterale, dialoghi |
| `full` | 9999px | Avatar, pip |

Precisione da officina: raggi contenuti, mai il "blob" da 20px+.

## 5. Ombre ed elevazione

L'elevazione si costruisce **prima con i bordi hairline e il contrasto
canvas/superficie**, poi con l'ombra. Tre livelli, tinte grafite:

| Token | Valore | Uso |
|---|---|---|
| `shadow-xs` | `0 1px 2px rgb(23 24 28 / 0.05)` | Card a riposo (opzionale) |
| `shadow-sm` | `0 1px 2px rgb(23 24 28 / 0.06), 0 4px 12px rgb(23 24 28 / 0.07)` | Menu, popover, card trascinata |
| `shadow-md` | `0 2px 6px rgb(23 24 28 / 0.07), 0 12px 32px rgb(23 24 28 / 0.11)` | Pannello laterale, dialoghi |

Mai ombre colorate, mai glow. Il "sollevamento" del drag = `shadow-sm` +
rotazione 1.5° — nient'altro.

## 6. Stati dei componenti

Convenzioni globali (Radix/shadcn: attributi `data-state`, `aria-*`):

| Stato | Regola universale |
|---|---|
| Default | Superficie + bordo del componente |
| Hover | Solo su pointer fine: fondo `surface-hover` o scurimento del riempimento; transizione 120ms; mai cambio di layout |
| Active/pressed | Pressione meccanica: 1px verso il basso (come un pulsante fisico); il primario scurisce a `brand-550` |
| Focus visibile | **Sempre**: ring 2px `brand-600` con offset 2px su superficie chiara; dentro superfici arancio: ring `ink`. Mai `outline: none` senza sostituto |
| Selected | Fondo `selected` (brand-50) + bordo `brand-300` o rail 2px `brand-500` |
| Disabled | Opacità 45%, cursore default, niente hover; mai disabilitare senza spiegare accanto il perché |
| Loading | `aria-busy`, spinner 16px `ink-muted` che sostituisce l'icona (mai il testo del bottone); skeleton `muted` con shimmer solo se >400ms |
| Error | Bordo `danger`, messaggio 13px `danger-text` sotto il campo, `aria-invalid` + `aria-describedby`; l'errore dice cosa correggere |
| Empty | Ogni vista vuota = invito all'azione: icona 20px `ink-faint`, una riga `ink-secondary`, un'azione (primaria solo se è l'azione principale della pagina) |
| Success | Conferma nel contesto (toast 3s o micro-check inline); il verbo resta coerente: "Salva" → "Salvato" |

Da `CLAUDE.md`: **ogni form implementa loading, success, empty ed error** —
nessuna eccezione.

### Bottoni (riferimento canonico)

| Variante | Fondo | Testo | Bordo | Hover |
|---|---|---|---|---|
| `primary` | `brand-500` | `ink` | — | `brand-550` |
| `outline` | `surface` | `ink` | `border-strong` | fondo `surface-hover` |
| `secondary` | `muted` | `ink` | — | `#E8E9EC` |
| `ghost` | trasparente | `ink-secondary` | — | fondo `surface-hover`, testo `ink` |
| `destructive` | `danger` | bianco | — | `#C2271B` |
| `link` | — | `brand-700` | — | sottolineato |

Un solo `primary` visibile per vista. Dimensioni: sm 32 / md 36 / lg 40.

## 7. Pattern di navigazione

```
┌────────────┬──────────────────────────────────────────────┐
│  Sidebar   │  Topbar: titolo pagina · filtri · [+ Nuovo]  │
│  240px     ├──────────────────────────────────────────────┤
│  bianca    │  Contenuto su canvas #F7F7F8       ┌─────────┤
│            │                                    │ Pannello│
│  ● Dash    │   [colonne board / liste]          │ laterale│
│  ● Task    │                                    │ 440px   │
│  ● Progetti│                                    │ overlay │
│  ● Team    │                                    │ bianco  │
│  ⚙ Imposta │                                    │shadow-md│
└────────────┴────────────────────────────────────┴─────────┘
```

- **Sidebar** (240px, bianca, bordo destro `border-soft`): wordmark in alto,
  voci 36px con icona 18px; stato attivo = testo `ink` 500 + **rail sinistro
  2px arancio** (unico arancio persistente a schermo); hover `surface-hover`;
  in basso avatar + nome. Niente sottomenu: la gerarchia è piatta.
- **Topbar** (56px, sulla colonna contenuto): titolo pagina (`title-page`),
  filtri a sinistra, azione primaria a destra. Non fissa su mobile.
- **Pannello laterale** (dettaglio task): overlay destro 440px su desktop,
  `shadow-md` + scrim 32%; URL `?task=<id>`; chiusura con Esc, click sullo
  scrim, o pulsante. Il focus entra nel pannello e torna al trigger alla
  chiusura (focus trap). **Mai modali** per i dettagli; i dialoghi restano per
  conferme distruttive.
- **Menu contestuali**: dropdown, mai più di 7 voci, distruttive in fondo
  separate da divisore.
- **Tastiera**: tutto raggiungibile in Tab; Esc chiude sempre l'overlay più
  recente; `/` porta al filtro della board (documentare in tooltip).

## 8. Motion

Libreria: **Motion**. Il movimento spiega da dove arrivano le cose; mai
decorativo. Preset in `lib/motion.ts`:

| Token | Valore | Uso |
|---|---|---|
| `dur.fast` | 120ms | Hover, pressed, cambi colore (CSS) |
| `dur.base` | 180ms | Fade/scale di menu, toast, tooltip |
| `dur.slow` | 260ms | Pannello laterale, drawer, sheet |
| `ease.out` | `cubic-bezier(0.2, 0, 0, 1)` | Ingressi e la maggior parte dei casi |
| `ease.inOut` | `cubic-bezier(0.45, 0, 0.15, 1)` | Uscite e spostamenti |

Preset: `fade` (opacity, 180ms) · `pop` (opacity + scale 0.98→1, 140ms, per
menu/popover) · `rise` (opacity + y 4px→0, 180ms, per toast e card) ·
`panel` (x 24px→0 + opacity, 260ms `ease.out`, per il pannello laterale) ·
`drawer` (x −100%→0, 260ms, per la sidebar mobile).

Regole: spostamenti max 24px; niente stagger oltre 3 elementi e 40ms; mai
animare `width/height` (solo transform/opacity); **`prefers-reduced-motion`
→ tutto diventa fade 80ms** (via `MotionConfig reducedMotion="user"` +
media query CSS). Un solo momento orchestrato per vista.

## 8b. Grafici (modulo Report)

Grafici SVG/HTML fatti in casa (nessuna libreria), metodo della skill
dataviz: prima la forma, poi il colore, palette **validata a script**.

- **Palette di stato dei grafici** (variante scura delle tacche, coppia
  arancio/verde verificata per CVD — ΔE protan 14.7): backlog `#A9AFB8`
  **tratteggiato a 45°** (eco della tacca tratteggiata), todo `#71767F`,
  in corso `#3E434B`, in revisione `#D97706`, fatto `#166534`.
  È monocromatica **per scelta**: l'identità dei segmenti è garantita da
  ordine fisso del flusso, legenda con le tacche (forma + colore), gap di
  2px, etichette dirette e tabella sr-only — le "relief" richieste dal
  metodo. Deviazioni accettate e documentate: croma nulla sui grigi
  (identità di prodotto) e contrasto del backlog < 3:1 (compensato da
  tratteggio + etichette).
- **Serie singole**: un solo colore (trend completamenti = verde `#166534`;
  barre per progetto = grafite `ink-secondary`), niente legenda — la nomina
  il titolo. Mai due assi y.
- **Marks**: linee 2px, estremo-dati arrotondato 4px ancorato alla baseline,
  griglia recessiva `border-soft`, testo sempre nei token ink (mai nel
  colore della serie), valori in mono.
- **Interazione**: tooltip su hover (crosshair sul trend, per-segmento sulle
  barre), mai informazione solo-hover: i valori chiave sono etichettati.
- **Numeri-titolo**: stat tile con count-up (rispetta reduced-motion) e
  delta vs periodo precedente.

## 9. Regole responsive

Breakpoint Tailwind standard; progettazione **desktop-first** (target
principale ≥1280px), degradazione controllata:

| Range | Sidebar | Pannello task | Board | Topbar |
|---|---|---|---|---|
| ≥1024 (`lg`) | 240px fissa | Overlay 440px | Colonne piene, scroll orizzontale oltre 5 | Titolo + filtri + azione |
| 768–1023 (`md`) | Rail icone 64px con tooltip | Overlay 420px | Colonne 280px min, scroll orizzontale con snap | Come desktop |
| <768 | Drawer da hamburger (overlay, `drawer`) | **Sheet a schermo intero** | Scroll orizzontale a colonna intera con snap | Compatta: hamburger + titolo + [+] |

- Le tabelle (Team, Impostazioni) diventano liste di card sotto `md`.
- Target touch ≥40px sotto `lg`; su desktop restano 32–36px.
- Nessun contenuto esclusivo di un breakpoint: si riorganizza, non si perde.
- Larghezza massima contenuto: board fluida; pagine di form/impostazioni 720px.

## 10. Accessibilità (soglia minima, non negoziabile)

- Contrasto: testo ≥4.5:1, testo large e componenti UI ≥3:1 — i token sopra
  sono già verificati; nuove combinazioni vanno verificate prima dell'uso.
- Focus visibile su ogni elemento interattivo (ring `brand-600`).
- Il colore non è mai l'unico canale: la tacca di stato ha forma diversa per
  ogni stato, gli errori hanno testo, non solo bordo rosso.
- Drag-and-drop sempre doppiato da un percorso tastiera (menu di stato).
- `aria-live="polite"` per toast ed esiti di salvataggio.
- Lingua UI: italiano (`lang="it"`), sentence case, verbi attivi
  ("Salva modifiche", non "Invia").

## 11. Implementazione

- `app/globals.css` — tutti i token colore/raggio/ombra/font come CSS custom
  properties mappate in `@theme inline` (Tailwind v4); include la variante
  `reduced-motion`.
- `app/layout.tsx` — Archivo + IBM Plex Mono via `next/font`, `lang="it"`,
  `MotionConfig reducedMotion="user"` nel provider client.
- `lib/motion.ts` — durate, easing e preset tipizzati.
- `components/ui/` — componenti shadcn ristilizzati sui token (il Button è
  il riferimento canonico degli stati).
- `components/status-pip.tsx` — la tacca di stato (SVG, 5 varianti).
- `/styleguide` — pagina di verifica visiva dei token (temporanea, interna).

Regola d'estensione: prima di aggiungere un token, dimostrare che nessun
token esistente copre il caso. Un'aggiunta = un aggiornamento di questo file.
