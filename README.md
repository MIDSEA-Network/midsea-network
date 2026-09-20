# MIDSEA Network website

Source for [midsea.network](https://midsea.network), built with
[Quarto](https://quarto.org).

**Updating content?** See [`EDITING.md`](EDITING.md) — most changes (news,
events, people, training/contact text) are plain-text edits, no coding
required, and can be made directly in GitHub's web editor.

## Pages

Each tab lives in its own folder, with `index.qmd` as that section's page:

- **Home** (`index.qmd` at the project root) — hero + latest News/Events
  pulled in automatically
- **News** (`news/index.qmd` + one file per post alongside it in `news/`)
- **People** (`people/index.qmd`, reading from `people/people.csv`) —
  currently empty, pending import from the existing Google Form/Sheet
- **Events** (`events/index.qmd` + one file per event alongside it in
  `events/`), with Online Events / Seminars / Summer School filters
- **Training** (`training/index.qmd` + one file per programme alongside it
  in `training/`)
- **Contact** (`contact/index.qmd`) — static

`_templates/` holds starter files to copy when adding a news post, event,
or training programme.

## Local development

Install [Quarto](https://quarto.org/docs/get-started/), then from the
project root:

```sh
quarto preview
```

This serves the site locally with live reload. `quarto render` builds the
static site into `_site/`.

## Deployment

`.github/workflows/publish.yml` renders and publishes the site to the
`gh-pages` branch on every push to `main` via GitHub Actions. Enable GitHub
Pages for the repo (Settings → Pages → Source: `gh-pages` branch) once, and
after that, publishing new content is just a matter of committing to `main`.
