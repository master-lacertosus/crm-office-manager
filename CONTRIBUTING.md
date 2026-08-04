# Come lavoriamo su questo repo

Repo condivisa. Per non pestarci i piedi seguiamo un flusso semplice a branch personali.

## Convenzione dei nomi dei branch

```
persona-argomento-feature
```

Esempi:

- `francesco-design-dashboard`
- `francesco-fix-mobile-overflow`
- `marco-backend-auth`

## Il ciclo di lavoro

1. **Parti sempre da `master` aggiornato**

   ```bash
   git checkout master
   git pull
   ```

2. **Crea il tuo branch personale**

   ```bash
   git checkout -b francesco-design-dashboard
   ```

3. **Lavora e committa quando vuoi**

   ```bash
   git add -A
   git commit -m "Messaggio chiaro"
   ```

4. **Pubblica il branch** (la prima volta con `-u`, poi basta `git push`)

   ```bash
   git push -u origin francesco-design-dashboard
   ```

5. **Apri una Pull Request** su GitHub: `francesco-design-dashboard` → `master`.
   L'altro dev dà un'occhiata, poi merge.

6. **Dopo il merge, pulisci**

   ```bash
   git checkout master
   git pull
   git branch -d francesco-design-dashboard
   ```

## Più sessioni in parallelo (worktree)

Due sessioni (editor, Claude, terminali) **nella stessa cartella si pestano
i piedi**: modifiche mescolate, checkout bloccati, commit sporchi. La regola:
**una cartella per sessione**. La copia principale è la "sessione 1"; ogni
altra sessione lavora in una copia collegata del repo (git worktree) sotto
`../crm-worktrees/`, ognuna col suo branch.

```bash
# apri una nuova sessione di lavoro (crea copia + branch da origin/master)
node scripts/worktree.mjs nuovo francesco-design-navbar

# poi, nella nuova finestra/sessione:
cd ../crm-worktrees/francesco-design-navbar
npm run dev        # parte su una porta libera in automatico

# vedi le copie attive
node scripts/worktree.mjs elenco

# dopo il merge della PR, chiudi la copia
node scripts/worktree.mjs chiudi francesco-design-navbar
```

Da sapere:

- **`master` vive solo nella copia principale**: nelle altre si lavora sempre
  su un branch (il comando `nuovo` lo crea già giusto, da `origin/master`
  aggiornato).
- Ogni copia ha i **suoi `node_modules`** (il comando fa l'install da solo) e
  il suo dev server su una **porta diversa** → anche i dati demo in
  localStorage sono separati per porta.
- Il ciclo resta identico: commit → push → PR → merge → `chiudi`.

## Regole per convivere in due

- **Mai committare direttamente su `master`.** Solo tramite Pull Request, così `master` resta sempre in uno stato buono.
- **Un branch = una cosa sola.** Finita quella, si chiude e se ne apre un altro. Branch piccoli = merge facili.
- **`git pull` su `master` prima di aprire un branch nuovo**, così parti dall'ultima versione dell'altro.
- Se un lavoro dura più giorni, ogni tanto porta le novità di `master` dentro il tuo branch:

  ```bash
  git checkout francesco-design-dashboard
  git merge master
  ```
