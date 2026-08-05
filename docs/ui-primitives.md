# UI Primitives — Lacertosus Office OS

Contratto del design system. Regola d'oro: **prima di stilizzare a mano,
cerca qui**. Se una primitiva esiste, si usa; se manca, si estende qui.

## Token (unica fonte: `app/globals.css` → `@theme` + `:root`)

- **Brand**: `--brand-50…900` (arancio #FF6B00). MAI hex arancio nei
  componenti: solo token o classi `brand-*`/`.btn-glow`.
- **Superfici**: canvas `#F6F8FC`, card bianche; materiali `.glass-chrome`
  (telaio), `.glass-strong` (overlay), `.glass-chip` (controlli),
  `.card-soft` (card contenuto), `.glass-hero` (vetrina), `.tile-aurora`.
- **Inchiostro**: `ink / ink-secondary / ink-muted / ink-faint`.
- **Semantici**: `success/danger/warning/info` + `-soft`/`-text`;
  stati task `--status-*` (+`-soft`,`-text`).
- **Radius**: controlli `rounded-lg` (8px), chip/menu `rounded-xl`,
  card 20–24 (`.card-soft`), dialoghi `rounded-3xl`.
- **Motion**: `lib/motion.ts` (`fade/pop/rise/panel/drawer/scrim`,
  durate 120/180/260ms, ease-out di sistema). CSS: `--ease-out`.
- **Z**: contenuto < topbar 30 < capo 30 < panel 40 < dropdown 50 <
  toast 60 < palette 70 < planner 75 < standup 80 < tour 85.
- **Profondità hover**: `.hover-lift`, pressione `.pressable`,
  lucentezza pip `.gem`, caricamento `.skeleton`.

## Mappa primitive richieste → implementazione reale

| Primitiva | Dove | Note |
|---|---|---|
| AppSurface | classe `.glass-chrome` | sidebar/topbar; materiale, non componente |
| GlassCard | `.card-soft` / `.glass-strong` / `.glass-chip` + `-soft` semantici | varianti via composizione classi |
| CardHeader | `Section` (dashboard-content) + `Card` (reports-content) | titolo+conteggio pillola+«Vedi tutti» |
| MetricCard | `charts/stat-tile.tsx` | label, value(+decimals), sublabel, delta(+label), icon, aurora, href, children (sparkline) |
| StatusBadge | `status-pip.tsx` (`StatusPip`/`StatusLabel`) | forma+colore+etichetta, mai colore-solo |
| PriorityBadge | `priority-badge.tsx` | modello reale: solo `high` è marcata (`iconOnly` per contesti densi) |
| Avatar | `avatar-initials.tsx` | foto opzionale (`src`, fallback iniziali), size, nome accessibile; stato online nel footer sidebar |
| AvatarGroup | non esiste | da creare SOLO quando un'area lo richiederà |
| ProgressBar | barre in workload-view / checklist (progressbar ARIA) | segmenti solo dove i dati li sostengono |
| ProgressRing | in `dashboard-content.tsx` | percent, done/total, delta, reduced-motion |
| EmptyState | `empty-state` usato in dashboard/board/archivio | icona+titolo+hint(+azione nel chiamante) |
| TaskRow | `TaskRow` (dashboard) / `Row` (task-list) / `MiniCard` (workload) | 3 densità legittime, stesso linguaggio chip |
| NotificationRow | `notifications.tsx` | non letto = tinta+peso+pallino+aria |
| TeamMemberRow | riga Polso (dashboard) + colonna carico (workload-view) | etichetta carico testuale obbligatoria |
| IconButton | `Button size="icon|icon-sm"` + `aria-label` | mai icona senza nome accessibile |
| Button | `ui/button.tsx` | default(=primary flat-glass `.btn-glow`), outline(=glass chip), secondary, ghost, destructive, link |
| Skeleton | classe `.skeleton` | shimmer, rispetta reduced-motion |

## Regole d'uso

1. **Una sola CTA arancio per vista**; la voce nav attiva USA `.btn-glow`
   (stessa ricetta, mai varianti quasi-uguali).
2. Vetro solo su telaio/overlay/controlli; le card dati restano solide.
3. Grafici: palette CVD in `analytics.ts`, NON i token UI; ogni coppia
   nuova passa dal validatore dataviz. Testo mai nel colore della serie.
4. Urgenza: `dueUrgency`/`DueChip` è l'unico linguaggio delle scadenze;
   aloni (ambra=Alta, rosso=ritardo) come profondità, il bordo resta.
5. Accessibilità: focus-visible ovunque, tabelle sr-only sotto i grafici,
   forme+etichette oltre al colore, reduced-motion su ogni animazione.
6. Niente nuove dipendenze npm (ambiente bloccato): icone extra si
   disegnano in `shell/nav-icons.tsx` (duotone: fill 16% + tratto 1.75).

## Dashboard componibile

I blocchi sotto l'hero (KPI + 6 sezioni) sono un layout per utente:
ordine, larghezza a preset (S=3 · M=4 · L=5 · XL=6 colonne su 12, `lg`+)
e visibilità vivono in `lib/dashboard-layout.ts` (localStorage
`dashboard-layout`, pattern «loaded flag», validato al load). La modalità
«Personalizza» (`components/dashboard-customize.tsx`) offre: drag con
maniglia e FLIP (`layout="position"`), resize del bordo destro che scatta
sui preset, chip S–XL, occhio per nascondere, frecce su/giù sotto `lg`
(che sono anche il percorso tastiera richiesto dal §10 del design system),
annunci `aria-live`, contenuto `inert` durante l'editing, «Ripristina».
Il blocco KPI è `fullWidth`: spostabile ma non ridimensionabile.

## Ferie & Permessi (`/leave`)

`components/leave-content.tsx` + logica pura in `lib/leave.ts` (conteggio
giorni LAVORATIVI: weekend e chiusure esclusi — unico numero mostrato
ovunque). Colori da `LEAVE_META` in `lib/types.ts`: ferie verde, permesso
blu; «in attesa» = pill tratteggiata (forma, non solo colore); chiusure =
fondo a righe con titolo nel primo giorno. Il form si apre con
`?request=1` (topbar e ⌘K, shallow via `updateSearch`). Coda «Da
approvare» solo admin: motivazione obbligatoria al rifiuto, facoltativa
all'approvazione; avvisi a richiedente + altri responsabili. Badge conta
pendenti sulla voce «Ferie» in sidebar (admin). Presenze riflesse nel
Polso del team e nelle card standup.

## Esempi dalla dashboard

- KPI: `<StatTile label="In ritardo" value={n} tone="danger" aurora=… href=…/>` —
  i `children` (es. `<Sparkline/>`) sono la fascia trend a tutta larghezza sul
  fondo della card; con la griglia `auto-rows-fr` ogni riga di tile resta alla
  stessa altezza
- Sezione: `<Section title="Focus di oggi" count={n} seeAllHref=…>…`
- Stato: `<StatusLabel status={task.status}/>` · Priorità: `<PriorityBadge iconOnly/>`
- Vuoto: `<EmptyState icon={Star} title=… hint=…/>` + azione nel chiamante
