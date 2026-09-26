# AGENTS.md

Instructions for AI coding agents working in this repository. For the
human, non-technical editing guide, see `EDITING.md`. For the general
project overview, see `README.md`.

## What this is

A [Quarto](https://quarto.org) static website rebuilding
[midsea.network](https://midsea.network) (currently a WordPress site) so
non-technical staff can update content via plain-text file edits — no
Quarto/HTML knowledge required for routine changes.

## Structure

Every navbar tab is a folder containing that section's `index.qmd`, except
Home, which stays at the project root (it must be `index.qmd` there to
serve the site's `/` URL — do not move it into a folder).

```
index.qmd              Home — hero + auto-pulled Latest News / Events
news/index.qmd          News listing page (Quarto `listing`)
news/*.qmd               One file per news post (front matter: title,
                          date, image, description)
events/index.qmd        Events listing page (Quarto `listing`, filterable
                          by categories)
events/*.qmd              One file per event (front matter: title, date,
                          event-dates, location, image, description,
                          categories)
people/index.qmd        People directory — renders people/people.csv as
                          cards via an OJS (Observable JS) code block
people/people.csv        One row per person: name, title, institution,
                          photo, profile_url, email_sha256
people/apply.qmd         Member application form; POSTs to the Apps Script
                          web app (see "Member application pipeline")
contact/index.qmd       Static
training/index.qmd      Training listing page (Quarto `listing`, currently
                          commented out of the navbar — see _quarto.yml)
training/*.qmd            One file per training programme (front matter:
                          title, date, event-dates, location, image,
                          description)
legal/index.qmd         Static (currently commented out of the navbar)
branding/index.qmd      Static (currently commented out of the navbar)
_templates/              Starter files for copy-pasting new news posts /
                          events / training programmes (news-template.qmd,
                          event-template.qmd, training-template.qmd) — the
                          leading underscore keeps Quarto from rendering or
                          listing them as content
images/                  logos/, news/, events/, training/, people/ — see
                          "Resource copying" below for why this whole tree
                          must stay declared in _quarto.yml
_quarto.yml               Site config: navbar, footer, theme, project
                          render/resource rules
styles.scss               Brand theme; the whole palette derives from one
                          $midsea-purple variable
.github/workflows/publish.yml
                          Renders and publishes to the gh-pages branch on
                          every push to main
.github/workflows/add-person.yml
                          Approved application -> PR -> merge (see below)
scripts/add_person.py     Upserts one people.csv row + photo from the
                          add-person repository_dispatch payload
scripts/apps-script/Code.gs
                          Apps Script bound to the applications Google
                          Sheet; not run from the repo, kept here for
                          version control
```

## Member application pipeline

1. `people/apply.qmd` POSTs each application to the `Code.gs` web app
   (`data-endpoint` on the form). `doPost()` appends a `Pending` row to the
   `Applications` tab and saves the photo to a Drive folder.
2. A maintainer sets Status to `Approved`. The installable `onStatusEdit`
   trigger sends a `repository_dispatch` event `add-person`, then writes
   `Sent to GitHub` (or the error in `Note`) on the row.
3. `add-person.yml` runs `add_person.py` and the image check, commits
   `people.csv` + `images/people/<slug>.<ext>` on a branch, and opens a
   PR. `render-check.yml` runs on it (the `render` check that the
   `protect-main` ruleset requires). The workflow waits for that check to
   pass, then merges; the merge starts `publish.yml`. A failed check leaves
   the PR open for a maintainer.

- The workflow uses the `PEOPLE_BOT_TOKEN` secret (fine-grained PAT, this
  repo only, Contents + Pull requests read/write), not `GITHUB_TOKEN`:
  `GITHUB_TOKEN` cannot bypass `protect-main`, the org does not let it
  open PRs, and its pushes/PRs would not start `render-check.yml` or
  `publish.yml`. When the PAT expires, the pipeline stops — renew it.
- The PAT owner may be a ruleset bypass actor, so the merge alone would
  not wait for `render`. Keep the explicit "Wait for render check" step.
- Approval lives in the Sheet: anyone with edit access to it can publish a
  person. The workflow has no environment gate or PR review.
- The photo travels inside the dispatch payload, which GitHub caps at
  64 KB. Apps Script cannot resize images, so the browser resizes the
  photo to a JPEG of at most `MAX_PHOTO_B64` base64 characters before
  sending. `Code.gs` rejects anything over `CONFIG.maxPhotoB64` or not a
  JPEG. Keep the two limits in step.
- The form POSTs without a `Content-Type` header on purpose: a
  `text/plain` request skips the CORS preflight, which Apps Script web
  apps do not answer. Do not add `application/json`.
- The Sheet holds plain emails; it is private. `people.csv` is published
  with the site, so it holds `email_sha256` (SHA-256 of the trimmed,
  lower-cased email), never a plain email. `Code.gs` hashes it before
  sending, so plain emails never reach GitHub. Gravatar looks up avatars by
  this same hash. Do not add a plain `email` column back.
- Rows match on `email_sha256` (else name), so a second application with
  the same email updates the row in place.
- `Code.gs` prefixes public input that starts with `= + - @` with `'` so
  it cannot run as a Sheet formula. A hidden `website` honeypot field
  drops simple bot posts.
- The Sheet's `MIDSEA` menu has "Send approved rows not yet sent" (retry
  and bulk path) and "Resend selected rows" (after fixing a typo in the
  Sheet).
- After editing `Code.gs`, redeploy the web app as a new version
  (Deploy -> Manage deployments -> Edit). The `/exec` URL stays the same.
- `add_person.py` NFC-normalizes text and drops non-`http(s)` profile URLs
  (the URL lands in an `<a href>`).

## Content-model conventions — follow these when adding features

- **News/events/training are one file per item**, discovered automatically
  by a Quarto `listing` block in that section's `index.qmd`. Don't
  hand-write card markup — add a `.qmd` file with the right front matter
  fields (copy `_templates/`) and the listing picks it up.
- **A listing page's `contents:` is relative to its own file**, and since
  `news/index.qmd` / `events/index.qmd` live *inside* the folder they
  list, their `contents:` is `.` (not `news`/`events`). Quarto
  automatically excludes a listing page from its own listing.
- **The Home page's mini-listings pull from those same folders from the
  root**, so Quarto's self-exclusion doesn't apply there — `index.qmd`'s
  `contents:` must explicitly negate the stub pages:
  ```yaml
  contents:
    - news
    - "!news/index.qmd"
  ```
  (same pattern for events). Forgetting this makes the listing stub page
  itself show up as a fake "latest" card on Home.
- **People is CSV + OJS, not one file per person** — deliberately, so a
  future bulk import (a Google Sheet export) is a one-file swap, not
  dozens of file edits. Columns: `name, title, institution, photo,
  profile_url`. Don't convert this to individual per-person `.qmd` files
  without discussing it — that was a considered tradeoff, not an
  oversight.
- **Contact/Legal/Branding are single static pages**, edited directly —
  they're one-off content, not a repeating collection, so they
  intentionally don't use the listing pattern.

- **All styling lives in `styles.scss`.** No `<style>` blocks, `style="..."`
  attributes, or extra CSS files in pages — give the element a class and
  add the rule to `styles.scss`, using the `$midsea-*` variables for brand
  colours. For page-level tweaks, prefer a Quarto front-matter option (e.g.
  `title-block-style: none` on Home) over CSS.

## Image naming convention

Content images (news / events / training) are named `YYYYMMDD-slug.ext`:

- `YYYYMMDD` is the item's front-matter `date:` (publish date) from the
  `.qmd` that references it — not the photo capture date. When two posts
  share one image file (e.g. events and news both point at
  `events/20250622-summer-school.jpg`), the file is named after the
  events post's date and lives in `images/events/`.
- `-slug` is a short descriptive suffix; `-trimmed` is reserved for
  alternate crops of the same date.
- Structural images are exempt: `images/logos/`, `images/hero-bg-lines.png`,
  `images/people/placeholder-avatar.svg`, and the `REPLACE-ME.jpg`
  placeholders in `_templates/` keep their names.
- When renaming images, use `git mv` and update both the `image:` front
  matter and any `![](...)` body references in the `.qmd` files. Known
  orphans (no referencing `.qmd`): `events/20260915-townhall.jpg`,
  `news/20260708-gsidd.jpg`.

## Path gotchas (things that will silently break)

- **Use root-relative image paths (`/images/...`), not relative ones**,
  anywhere an image path is written as a *string* that the **browser**
  resolves relative to the page's own URL — e.g. inside the OJS code in
  `people/index.qmd` and in the `photo` column of `people/people.csv`.
  Because pages live at different folder depths (`index.qmd` at root vs.
  `people/index.qmd` one level down), a plain relative path resolves
  differently depending on which page renders it, and breaks the moment
  content moves. But the browser must never resolve these strings
  directly: the site is deployed under a subpath
  (`midsea-network.github.io/midsea-network/`), so a raw `/images/...`
  hits the domain root and 404s. `people/index.qmd` passes every path
  through its `siteUrl()` helper, which resolves it against the site root.
  Any new JS that builds an image URL must do the same.
- **`styles.scss` `url(...)` is the opposite case — use a plain relative
  path (`images/...`), not root-relative.** Quarto compiles `styles.scss`
  into a bundled CSS file under `_site/site_libs/bootstrap/`, and it *does*
  scan that SCSS source for `url(...)` references and copies the files
  they point to into that bundle folder (e.g.
  `site_libs/bootstrap/images/hero-bg-lines.png`) — but it resolves a
  relative `url(...)` path against the `.scss` file's own location
  (`styles.scss` sits at the project root, so `url("images/...")` finds
  `images/...` there), and it rewrites the compiled CSS's `url(...)` to
  match the copied file's new location relative to the bundle. That makes
  the reference work under any deployment base path. A **root-relative**
  `url("/images/...")` path also gets copied, but the compiled CSS keeps
  the literal root-relative text unchanged — the browser then resolves it
  against the *site's* root, which only happens to be right when the site
  is served from a domain root. It silently 404s once the site is deployed
  under a subpath (e.g. GitHub Pages project pages at
  `<user>.github.io/midsea-network/`), even though it renders fine in
  local preview. Verify any future change here by grepping the compiled
  `_site/site_libs/bootstrap/*.min.css` for the filename and confirming
  the referenced path actually exists relative to that CSS file.
- **Quarto's automatic resource-copying doesn't see every image
  reference** — it detects `image:` front matter, `![]()` markdown, and
  (per above) `url(...)` inside a `format: html: theme:` SCSS file, but not
  an image path embedded in an OJS/JS string. That's why `_quarto.yml` has:
  ```yaml
  project:
    resources:
      - images
  ```
  If you add a new top-level asset folder that's referenced only from
  CSS/JS, add it here too, or it will work locally in some cases but go
  missing from the built `_site/`.
- **`EDITING.md` must stay excluded from the Quarto render list** — by
  default a Quarto website project renders every `.qmd`/`.md` file it
  finds, which turns `EDITING.md` into a published page. It's excluded via:
  ```yaml
  project:
    render:
      - "*.qmd"
      - "!EDITING.md"
  ```
  If you add other repo-only `.md` docs, exclude them the same way.

## Build / verify

Quarto is not installed globally on the dev machine this was built on
(the Homebrew cask needs an interactive `sudo` password). A portable,
no-install copy works fine for local verification:

```sh
curl -fsSL -o /tmp/quarto.tar.gz \
  https://github.com/quarto-dev/quarto-cli/releases/download/v1.6.42/quarto-1.6.42-macos.tar.gz
tar -xzf /tmp/quarto.tar.gz -C /tmp/quarto-local
/tmp/quarto-local/bin/quarto render   # or: quarto render, if installed
```

After any structural change (new page, moved file, changed listing
config), always `quarto render` and check:
- It exits 0 and renders the expected number of pages.
- `grep -c 'class="quarto-grid-item'` on a listing page's output matches
  the number of real content files (catches stub pages leaking into
  listings).
- Serve `_site/` with `python3 -m http.server` and `curl` the pages and
  key image assets for `200`s (catches missing-resource regressions).

`_site/` and `.quarto/` are build output — gitignored, safe to
`rm -rf` and regenerate at any time, never hand-edit.

## Content provenance

Sample News/Events content and images were pulled from the live
midsea.network (WordPress) site during the initial build, matched by
scraping each listing page's actual title/date/image so samples are real,
not fabricated. Photos were converted from the source site's WebP format
to JPEG for broader compatibility. The People directory was deliberately
left empty (pending a Google Form/Sheet import) rather than pre-filled.
