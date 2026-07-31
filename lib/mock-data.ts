import { addDaysIso } from "@/lib/format";
import type {
  AppNotification,
  Profile,
  Project,
  ProjectComment,
  Task,
  TaskComment,
  TaskEvent,
  WorkspaceTemplate,
} from "@/lib/types";

/**
 * Dati placeholder — squadra reale dell'ufficio (30/07/2026). Con Supabase
 * il passaggio sarà una sostituzione di sorgente, non di forma.
 * Persistenza: nessuna (in memoria, si azzera al refresh).
 */

const U = {
  francesco: "00000000-0000-4000-8000-000000000001",
  sara: "00000000-0000-4000-8000-000000000002",
  lorenzo: "00000000-0000-4000-8000-000000000003",
  klea: "00000000-0000-4000-8000-000000000004",
  riccardo: "00000000-0000-4000-8000-000000000005",
  enrico: "00000000-0000-4000-8000-000000000006",
  matteo: "00000000-0000-4000-8000-000000000007",
} as const;

const P = {
  blackFriday: "00000000-0000-4000-8000-000000000101",
  rebranding: "00000000-0000-4000-8000-000000000102",
} as const;

/** Utente corrente della demo: Francesco (responsabile · webmaster). */
export const CURRENT_USER_ID: string = U.francesco;

export const MOCK_PROFILES: Profile[] = [
  {
    id: U.francesco,
    full_name: "Francesco Salafia",
    email: "webmaster@lacertosus.com",
    role: "admin",
    title: "Responsabile · Webmaster",
    is_active: true,
  },
  {
    id: U.sara,
    full_name: "Sara Tagliaferri",
    email: "sara@lacertosus.com",
    role: "admin",
    title: "Responsabile",
    is_active: true,
  },
  {
    id: U.lorenzo,
    full_name: "Lorenzo Cavicchioli",
    email: "lorenzo@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.klea,
    full_name: "Klea Qyra",
    email: "klea@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.riccardo,
    full_name: "Riccardo Videomaker",
    email: "riccardo@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.enrico,
    full_name: "Enrico Amedei",
    email: "enrico@lacertosus.com",
    role: "member",
    is_active: true,
  },
  {
    id: U.matteo,
    full_name: "Matteo Morelli",
    email: "matteo@lacertosus.com",
    role: "member",
    is_active: true,
  },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: P.blackFriday,
    name: "Black Friday 2026",
    description: "Campagna Q4: landing, ADV, email e coordinamento e-commerce.",
    is_archived: false,
    created_by: U.sara,
  },
  {
    id: P.rebranding,
    name: "Rebranding schede prodotto",
    description:
      "Refresh di copy e fotografia per le schede dei power rack e delle rig.",
    is_archived: false,
    created_by: U.lorenzo,
  },
];

/**
 * Attività standard del mese: partenza realistica per i responsabili,
 * modificabile da Impostazioni → Workspace (persistita in locale).
 */
export const MOCK_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "tpl-newsletter-promo",
    name: "Newsletter Promo",
    description: "Invio mensile con l'offerta del mese al database completo.",
    project_id: null,
    owner_id: U.enrico,
    priority: "high",
    repeat: "monthly",
    due_day: 5,
    checklist: [
      "Soggetto e preheader",
      "Offerta del mese",
      "Blocco novità",
      "CTA e link tracciati",
      "Test invio",
    ],
    links: [
      {
        url: "https://docs.google.com/document/d/linee-guida-newsletter",
        label: "Linee guida",
      },
    ],
  },
  {
    id: "tpl-articolo-blog",
    name: "Pubblicazione articolo blog",
    description: "Uscita bisettimanale sul blog Lacertosus.",
    project_id: null,
    owner_id: U.francesco,
    priority: "normal",
    repeat: "biweekly",
    due_day: 8,
    checklist: [
      "Scelta argomento e keyword",
      "Bozza e revisione",
      "Immagini ottimizzate",
      "SEO on-page",
      "Pubblicazione e condivisione",
    ],
    links: [],
  },
  {
    id: "tpl-newsletter-commerciale",
    name: "Newsletter reparto Commerciale",
    description: "Invio mensile al segmento aziende e rivenditori.",
    project_id: null,
    owner_id: U.enrico,
    priority: "normal",
    repeat: "monthly",
    due_day: 15,
    checklist: [
      "Input dal commerciale (offerte B2B)",
      "Listino aggiornato",
      "Revisione responsabile",
      "Invio segmento aziende",
    ],
    links: [],
  },
  {
    id: "tpl-rubrica-arena",
    name: "Rubrica Lacertosus Arena",
    description: "Appuntamento mensile con atleti e box della community.",
    project_id: null,
    owner_id: U.klea,
    priority: "normal",
    repeat: "monthly",
    due_day: 20,
    checklist: [
      "Selezione atleta/box del mese",
      "Intervista e materiale foto",
      "Montaggio contenuti social",
      "Pubblicazione rubrica",
    ],
    links: [],
  },
  {
    id: "tpl-video-youtuber",
    name: "Video YouTuber",
    description: "Collaborazione mensile con un creator.",
    project_id: null,
    owner_id: U.riccardo,
    priority: "normal",
    repeat: "monthly",
    due_day: 25,
    checklist: [
      "Accordo con il creator",
      "Brief prodotto e talking points",
      "Revisione bozza video",
      "Pubblicazione e repost",
    ],
    links: [],
  },
  {
    id: "tpl-shooting",
    name: "Shooting prodotto",
    description: "Servizio fotografico completo di una referenza.",
    project_id: null,
    owner_id: U.riccardo,
    priority: "normal",
    repeat: "none",
    due_day: null,
    checklist: [
      "Lista referenze prodotto",
      "Still life fondo bianco",
      "Dettagli (zigrinatura, saldature)",
      "3 angolazioni per variante",
      "Consegna in cartella condivisa",
    ],
    links: [
      {
        url: "https://drive.google.com/drive/folders/reference-shooting",
        label: "Cartella reference",
      },
    ],
  },
  {
    id: "tpl-lancio",
    name: "Lancio prodotto",
    description:
      "Pacchetto: cinque task collegati, con scadenze relative alla data di lancio scelta.",
    project_id: null,
    owner_id: U.sara,
    priority: "high",
    repeat: "none",
    due_day: null,
    pack: [
      { title: "Lancio — scheda prodotto online", owner_id: U.lorenzo, offset_days: -10 },
      { title: "Lancio — foto e video prodotto", owner_id: U.riccardo, offset_days: -7 },
      { title: "Lancio — newsletter dedicata", owner_id: U.enrico, offset_days: -3 },
      { title: "Lancio — post social programmati", owner_id: U.matteo, offset_days: -2 },
      { title: "Lancio — ADV attive", owner_id: U.sara, offset_days: 0 },
    ],
    links: [],
  },
];

const t = (offsetMin: number) =>
  new Date(Date.now() - offsetMin * 60_000).toISOString();

const CURRENT_TASKS: Task[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    title: "Brief influencer Q4",
    description: "Selezione atleti e brief per la campagna Black Friday.",
    status: "backlog",
    priority: "normal",
    owner_id: U.klea,
    created_by: U.klea,
    project_id: P.blackFriday,
    due_date: null,
    position: 1,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 6),
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    title: "Audit SEO categorie accessori",
    description: null,
    status: "backlog",
    priority: "low",
    owner_id: U.francesco,
    created_by: U.francesco,
    project_id: null,
    due_date: null,
    position: 2,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 5),
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    title: "Calendario editoriale ottobre",
    description: "Piano contenuti social e blog per ottobre.",
    status: "todo",
    priority: "normal",
    owner_id: U.matteo,
    created_by: U.matteo,
    project_id: P.blackFriday,
    due_date: addDaysIso(7),
    position: 3,
    repeat: "monthly",
    completed_at: null,
    created_at: t(60 * 24 * 4),
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    title: "Foto still life OKTA RIG 3.5",
    description:
      "Still life su fondo bianco, dettaglio zigrinatura, tre angolazioni.",
    status: "todo",
    priority: "high",
    owner_id: U.riccardo,
    created_by: U.riccardo,
    project_id: P.rebranding,
    due_date: addDaysIso(3),
    position: 4,
    repeat: "none",
    checklist: [
      { id: "cl-204-1", text: "Still life fondo bianco", done: true },
      { id: "cl-204-2", text: "Dettaglio zigrinatura", done: false },
      { id: "cl-204-3", text: "Tre angolazioni per variante", done: false },
    ],
    completed_at: null,
    created_at: t(60 * 24 * 4),
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    title: "Newsletter di settembre",
    description: "Focus nuovi arrivi + guida all'allenamento in rack.",
    status: "in_progress",
    priority: "high",
    owner_id: U.enrico,
    created_by: U.enrico,
    project_id: P.blackFriday,
    due_date: addDaysIso(1),
    position: 5,
    repeat: "weekly",
    checklist: [
      { id: "cl-205-1", text: "Soggetto e preheader", done: true },
      { id: "cl-205-2", text: "Blocco nuovi arrivi", done: true },
      { id: "cl-205-3", text: "Guida allenamento in rack", done: false },
      { id: "cl-205-4", text: "Test invio", done: false },
    ],
    completed_at: null,
    created_at: t(60 * 24 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000206",
    title: "Aggiornare schede prodotto power rack PRO",
    description:
      "Nuove misure, tabella compatibilità accessori, video di montaggio.",
    status: "alert",
    problem_reason: "Mancano le misure aggiornate dal fornitore.",
    problem_since: t(60 * 24 * 3),
    priority: "normal",
    owner_id: U.lorenzo,
    created_by: U.sara,
    project_id: P.rebranding,
    due_date: addDaysIso(-2),
    position: 6,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000207",
    title: "Landing Black Friday — copy",
    description: "Prima stesura hero + sezioni offerta. In attesa di revisione.",
    status: "in_review",
    priority: "high",
    owner_id: U.sara,
    created_by: U.sara,
    project_id: P.blackFriday,
    due_date: addDaysIso(2),
    position: 7,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 2),
  },
  {
    id: "00000000-0000-4000-8000-000000000208",
    title: "Banner homepage autunno",
    description: null,
    status: "in_review",
    priority: "normal",
    owner_id: U.riccardo,
    created_by: U.riccardo,
    project_id: P.rebranding,
    due_date: addDaysIso(0),
    position: 8,
    repeat: "none",
    completed_at: null,
    created_at: t(60 * 24 * 2),
  },
  {
    id: "00000000-0000-4000-8000-000000000209",
    title: "Setup tracking GA4 campagne",
    description: "Eventi e conversioni per le campagne Q4.",
    status: "done",
    priority: "normal",
    owner_id: U.francesco,
    created_by: U.francesco,
    project_id: P.rebranding,
    due_date: null,
    position: 9,
    repeat: "none",
    completed_at: t(60 * 26),
    created_at: t(60 * 24 * 8),
  },
  {
    id: "00000000-0000-4000-8000-000000000210",
    title: "Migrazione listino B2B",
    description: null,
    status: "done",
    priority: "low",
    owner_id: U.lorenzo,
    created_by: U.lorenzo,
    project_id: null,
    due_date: null,
    position: 10,
    repeat: "none",
    completed_at: t(60 * 24 * 2),
    created_at: t(60 * 24 * 10),
  },
];

/* ------------------------------------------------------------------ */
/* Storico sintetico: ~10 settimane di lavoro completato               */
/* ------------------------------------------------------------------ */

const HISTORY_TITLES = [
  "Post social settimana",
  "Report ADV settimanale",
  "Aggiornamento prezzi listino",
  "Ottimizzazione immagini categoria",
  "Risposte recensioni clienti",
  "Programmazione post Instagram",
  "Verifica feed Google Shopping",
  "Copy promo weekend",
  "Shooting dettagli manubri",
  "Montaggio reel palestra",
  "Traduzione schede EN",
  "Controllo link rotti blog",
  "Piano editoriale settimana",
  "Brief grafico banner",
  "Test A/B popup iscrizione",
  "Pulizia liste email",
  "Storie Instagram fiera",
  "Bozza articolo tecnica",
  "Verifica stock foto prodotti",
  "Caricamento video YouTube",
  "Aggiornare FAQ spedizioni",
  "Analisi resi mensile",
];

/** PRNG deterministico (stesso seme → stesso storico a ogni reset). */
function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

/**
 * Genera task completati (con eventi) distribuiti sugli ultimi 60 giorni:
 * dà profondità reale ai report per intervallo e all'archivio. Quelli
 * completati da più di 14 giorni nascono già archiviati.
 */
const HISTORY: { tasks: Task[]; events: TaskEvent[] } = (() => {
  const rnd = lcg(20260731);
  const owners = [
    U.francesco,
    U.sara,
    U.lorenzo,
    U.klea,
    U.riccardo,
    U.enrico,
    U.matteo,
  ];
  const projectPool = [P.blackFriday, P.rebranding, null, null];
  const tasks: Task[] = [];
  const events: TaskEvent[] = [];
  let n = 0;
  for (let day = 60; day >= 1; day--) {
    const roll = rnd();
    const perDay = roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;
    for (let k = 0; k < perDay; k++) {
      n++;
      const owner = owners[Math.floor(rnd() * owners.length)];
      const completedMs =
        Date.now() - day * 86_400_000 - Math.floor(rnd() * 9) * 3_600_000;
      const leadDays = 2 + Math.floor(rnd() * 6);
      const createdMs = completedMs - leadDays * 86_400_000;
      const id = `hist-${String(n).padStart(3, "0")}`;
      const completedIso = new Date(completedMs).toISOString();
      tasks.push({
        id,
        title: HISTORY_TITLES[n % HISTORY_TITLES.length],
        description: null,
        status: "done",
        priority: rnd() < 0.2 ? "high" : "normal",
        owner_id: owner,
        created_by: owner,
        project_id: projectPool[Math.floor(rnd() * projectPool.length)],
        due_date: completedIso.slice(0, 10),
        position: 1000 + n,
        repeat: "none",
        archived_at: day > 14 ? completedIso : null,
        completed_at: completedIso,
        created_at: new Date(createdMs).toISOString(),
      });
      events.push(
        {
          id: `ev-${id}-c`,
          task_id: id,
          actor_id: owner,
          type: "created",
          created_at: new Date(createdMs).toISOString(),
        },
        {
          id: `ev-${id}-p`,
          task_id: id,
          actor_id: owner,
          type: "status_changed",
          from: "todo",
          to: "in_progress",
          created_at: new Date(createdMs + 86_400_000).toISOString(),
        },
        {
          id: `ev-${id}-d`,
          task_id: id,
          actor_id: owner,
          type: "status_changed",
          from: "in_progress",
          to: "done",
          created_at: completedIso,
        },
      );
    }
  }
  return { tasks, events };
})();

/** Eventi minimi dei task correnti (creazione + fase attuale). */
const CURRENT_EVENTS: TaskEvent[] = CURRENT_TASKS.flatMap((task, i) => {
  const list: TaskEvent[] = [
    {
      id: `ev-cur-${i}-c`,
      task_id: task.id,
      actor_id: task.created_by,
      type: "created",
      created_at: task.created_at,
    },
  ];
  if (!["backlog", "todo"].includes(task.status)) {
    list.push({
      id: `ev-cur-${i}-s`,
      task_id: task.id,
      actor_id: task.owner_id,
      type: "status_changed",
      from: "todo",
      to: task.status,
      created_at: task.completed_at ?? t(60 * 24),
    });
  }
  return list;
});

export const MOCK_TASKS: Task[] = [...CURRENT_TASKS, ...HISTORY.tasks];
export const MOCK_EVENTS: TaskEvent[] = [
  ...CURRENT_EVENTS,
  ...HISTORY.events,
];

export const MOCK_PROJECT_COMMENTS: ProjectComment[] = [
  {
    id: "00000000-0000-4000-8000-000000000601",
    project_id: P.blackFriday,
    author_id: U.sara,
    body: "Direzione confermata con la proprietà: si parte col configuratore in homepage per il Black Friday.",
    created_at: t(60 * 27),
    is_decision: true,
    reactions: { "👍": [U.francesco, U.riccardo] },
  },
  {
    id: "00000000-0000-4000-8000-000000000602",
    project_id: P.blackFriday,
    author_id: U.riccardo,
    body: "@Team caricate le vostre proposte di visual entro venerdì nella cartella condivisa.",
    created_at: t(60 * 4),
    reactions: { "✅": [U.klea] },
  },
];

export const MOCK_TASK_LINKS = [
  {
    id: "00000000-0000-4000-8000-000000000501",
    task_id: "00000000-0000-4000-8000-000000000207",
    url: "https://www.figma.com/file/landing-black-friday",
    label: "Bozza Figma della landing",
  },
  {
    id: "00000000-0000-4000-8000-000000000502",
    task_id: "00000000-0000-4000-8000-000000000204",
    url: "https://picsum.photos/seed/oktarig/320/200",
    label: "Reference still life",
  },
  {
    id: "00000000-0000-4000-8000-000000000503",
    task_id: "00000000-0000-4000-8000-000000000207",
    url: "https://docs.google.com/document/d/brief-bf-2026",
    label: "Brief campagna",
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "00000000-0000-4000-8000-000000000401",
    to_user_id: U.francesco,
    from_user_id: U.enrico,
    message:
      "La newsletter è quasi pronta: mi serve il tuo ok sul soggetto entro stasera.",
    task_id: "00000000-0000-4000-8000-000000000205",
    kind: "sollecito",
    created_at: t(45),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000402",
    to_user_id: U.francesco,
    from_user_id: U.lorenzo,
    message: "Caricate le foto del rack PRO: puoi verificare le didascalie?",
    task_id: "00000000-0000-4000-8000-000000000206",
    kind: "mention",
    created_at: t(60 * 4),
    read_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000403",
    to_user_id: U.francesco,
    from_user_id: U.riccardo,
    message: "Il fornitore dei banner ha confermato la consegna per venerdì.",
    task_id: null,
    kind: "sistema",
    created_at: t(60 * 26),
    read_at: t(60 * 20),
  },
];

export const MOCK_COMMENTS: TaskComment[] = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    task_id: "00000000-0000-4000-8000-000000000207",
    author_id: U.matteo,
    body: "Il tono del hero mi sembra troppo tecnico: proverei una variante più diretta.",
    created_at: t(60 * 5),
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    task_id: "00000000-0000-4000-8000-000000000207",
    author_id: U.sara,
    body: "Concordo, preparo la variante B entro domani.",
    created_at: t(60 * 3),
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    task_id: "00000000-0000-4000-8000-000000000205",
    author_id: U.klea,
    body: "Ricordati il blocco UGC con le foto dei clienti in palestra.",
    created_at: t(60 * 28),
  },
  {
    id: "00000000-0000-4000-8000-000000000304",
    task_id: "00000000-0000-4000-8000-000000000208",
    author_id: U.klea,
    body: "Il verde del banner stona con la palette autunno: vedi moodboard.",
    created_at: t(60 * 50),
  },
];
