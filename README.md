# Husholdningsverket

Familiens økonomi og handlelister, del av Verket-serien.
Cloudflare Pages + Functions + D1, e-post via Resend og Claude API for kvitteringer og kategoriforslag.

## Mapper

```
public/                 Det brukeren ser
  index.html
  css/app.css
  js/app.js             Oppstart, navigasjon og alle handlinger
  js/api.js             Kall til serveren
  js/state.js           Tilstand og felles hjelpere
  js/util.js            Formatering, datoer, CSV
  js/views/*.js         Én fil per side
functions/api/          API-et (kjører på Cloudflare)
  auth/                 Innlogging med magisk lenke
  admin/                Superadmin: husholdninger og eierinvitasjoner
  h/[hid]/              Alt innenfor én husholdning (krever medlemskap)
lib/                    Felles serverkode
migrations/             Databasetabeller
```

## Regel nummer én

Ekte økonomidata skal aldri inn i Git: ingen CSV-filer fra banken, ingen kvitteringer, ingen nøkler.
`.gitignore` stopper de vanligste filene, men sjekk alltid `git status` før commit.

## Lokal utvikling

```bash
npm install
cp .dev.vars.example .dev.vars        # fyll inn e-posten din som SUPERADMIN_EMAIL
npm run db:local                      # lager tabellene lokalt
npm run dev                           # åpne http://localhost:8788
```

Med `DEV=1` i `.dev.vars` vises innloggingslenken direkte i appen, så du slipper e-post lokalt.
Uten `ANTHROPIC_API_KEY` virker alt unntatt kvitteringslesing og Claude-forslag.

## Produksjon (Cloudflare Pages)

1. `npx wrangler d1 create husholdningsverket` og lim inn `database_id` i `wrangler.toml`
2. `npm run db:remote`
3. Koble repoet til et Pages-prosjekt (build command: tom, output: `public`)
4. Legg inn secrets under Settings → Variables and Secrets:
   `SUPERADMIN_EMAIL`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` (IKKE `DEV`)
5. Bind D1-databasen som `DB` hvis den ikke plukkes opp fra `wrangler.toml`
6. Bilder av kvitteringer: `npx wrangler r2 bucket create husholdningsverket-kvitteringer`
   (bindes som `RECEIPTS` via `wrangler.toml`; uten den lagres kvitteringene uten bilde)
7. Eget domene: CNAME `husholdningsverket` → `husholdningsverket.pages.dev` hos Webshop, og legg til domenet under Custom domains i Pages

## Første innlogging

Logg inn med e-posten i `SUPERADMIN_EMAIL`. Gå til «Husholdninger (admin)», opprett husholdningen
med din egen e-post som eier, og inviter resten av familien under «Medlemmer».

Superadmin ser bare navn, medlemmer og invitasjoner i andre husholdninger, aldri økonomidata.

## Nye tabeller senere

Lag en ny fil i `migrations/` (for eksempel `0002_noe.sql`) og kjør `npm run db:local` og `npm run db:remote`.
Endre aldri en migrering som allerede er kjørt.
