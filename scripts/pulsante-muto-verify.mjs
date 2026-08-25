/**
 * Il pulsante che smette di rispondere.
 *
 * «Salva modifiche» e' `disabled={saving}`. Il gestore accendeva `saving`,
 * faceva il lavoro e lo spegneva alla fine -- ma senza `finally`. Se in
 * mezzo saltava fuori un errore, lo spegnimento non avveniva mai: il
 * pulsante restava disabilitato per sempre, e ogni clic successivo non
 * faceva niente. Nemmeno un messaggio: sembrava che l'app ignorasse.
 *
 * E' il modo peggiore di fallire. Un errore a schermo si legge e si
 * riferisce; un pulsante che non reagisce lascia solo il dubbio di aver
 * cliccato male.
 *
 * Qui si riproduce il gestore nelle due versioni e si guarda cosa succede
 * al secondo clic.
 *
 *   node scripts/pulsante-muto-verify.mjs
 */
import { messaggioErrore } from "../lib/errori.ts";

let falliti = 0;
function check(nome, ok, dettaglio = "") {
  if (!ok) falliti++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

/** Un modulo minimo con lo stesso stato del vero pannello. */
function creaModulo({ conFinally, salva }) {
  const stato = { saving: false, errore: null, salvato: false, tentativi: 0 };
  return {
    stato,
    // Il pulsante e' disabilitato mentre si salva: un clic in quel momento
    // non arriva nemmeno al gestore, esattamente come nel browser.
    get abilitato() {
      return !stato.saving;
    },
    async clic() {
      if (stato.saving) return "IGNORATO";
      stato.tentativi++;
      stato.errore = null;
      stato.saving = true;
      if (conFinally) {
        try {
          await salva();
          stato.salvato = true;
        } catch (e) {
          stato.errore = messaggioErrore(e, "Salvataggio non riuscito.");
        } finally {
          stato.saving = false;
        }
      } else {
        // La versione di prima: se `salva` lancia, la riga dopo non parte.
        await salva();
        stato.saving = false;
        stato.salvato = true;
      }
      return "GESTITO";
    },
  };
}

const RIFIUTO = {
  message: 'new row violates row-level security policy for table "tasks"',
  code: "42501",
};
const salvaCheFallisce = async () => {
  throw RIFIUTO;
};

/* --- 1. Senza finally: il pulsante muore al primo errore ------------- */
{
  const m = creaModulo({ conFinally: false, salva: salvaCheFallisce });
  await m.clic().catch(() => {});
  check(
    "Senza finally il pulsante resta disabilitato dopo l'errore",
    m.abilitato === false,
    `saving=${m.stato.saving}`,
  );
  const secondo = await m.clic().catch(() => "IGNORATO");
  check(
    "Senza finally il secondo clic non arriva nemmeno al gestore",
    secondo === "IGNORATO" && m.stato.tentativi === 1,
    `tentativi arrivati: ${m.stato.tentativi}`,
  );
  check(
    "Senza finally non compare nessun motivo a schermo",
    m.stato.errore === null,
    "l'utente clicca e non succede niente",
  );
}

/* --- 2. Con finally: il pulsante torna vivo e dice perche' ----------- */
{
  const m = creaModulo({ conFinally: true, salva: salvaCheFallisce });
  await m.clic();
  check(
    "Con finally il pulsante torna cliccabile",
    m.abilitato === true,
    `saving=${m.stato.saving}`,
  );
  check(
    "Con finally a schermo compare il motivo vero",
    typeof m.stato.errore === "string" && m.stato.errore.includes("42501"),
    m.stato.errore,
  );
  const secondo = await m.clic();
  check(
    "Con finally il secondo clic viene gestito",
    secondo === "GESTITO" && m.stato.tentativi === 2,
    `tentativi arrivati: ${m.stato.tentativi}`,
  );
}

/* --- 3. Quando va bene, va bene ------------------------------------- */
{
  const m = creaModulo({ conFinally: true, salva: async () => {} });
  await m.clic();
  check(
    "Se il salvataggio riesce: nessun errore e pulsante pronto",
    m.stato.salvato && m.stato.errore === null && m.abilitato,
  );
}

/* --- 4. Un errore di Supabase non e' un Error ------------------------ */
{
  check(
    "Il vecchio controllo scartava gli errori di Supabase",
    !(RIFIUTO instanceof Error),
    "per questo si leggeva il ripiego invece del motivo",
  );
  check(
    "messaggioErrore invece li legge",
    messaggioErrore(RIFIUTO, "ripiego").includes("row-level security"),
    messaggioErrore(RIFIUTO, "ripiego"),
  );
}

console.log(falliti === 0 ? "\nTUTTO VERDE" : `\n${falliti} CONTROLLI FALLITI`);
process.exit(falliti === 0 ? 0 : 1);
