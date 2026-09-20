# Editing the MIDSEA Network website

This site is built with [Quarto](https://quarto.org). You do **not** need to
know how to code to update most content — you're editing plain text files
with a few `field: value` lines at the top, the same idea as filling in a
form.

The easiest way to make small edits is directly on GitHub, in your browser,
with no software to install:

1. Go to the file you want to change on the repository's GitHub page.
2. Click the pencil ("Edit this file") icon.
3. Make your change.
4. Scroll down, add a short message describing the change, and click
   "Commit changes directly to the `main` branch."
5. Wait 2-3 minutes — the site rebuilds and publishes automatically. No
   further action needed.

If you'd rather work locally, install Quarto
(<https://quarto.org/docs/get-started/>), then from the project folder run
`quarto preview` to see your changes live before committing/pushing.

---

## Add a news item

1. Open the `_templates/news-template.qmd` file.
2. Copy it into the `news/` folder and rename it, e.g.
   `news/2026-03-my-update.qmd` (the filename doesn't matter much, but
   starting it with the date keeps the folder tidy).
3. Fill in the fields at the top of the file:
   - `title` — headline shown on the News page
   - `date` — format `YYYY-MM-DD`, controls sort order
   - `image` — path to a photo (add the photo file to `images/news/` first)
   - `description` — one or two sentences shown on the card
4. Write the full story below the `---` line.
5. Commit. It will appear automatically on the News page and Home page,
   newest first.

## Add an event

Same idea, using `_templates/event-template.qmd` copied into `events/`:

- `title`, `date` (`YYYY-MM-DD`, used for sorting), `image`, `description` —
  same as news.
- `event-dates` — the human-readable date text shown on the card, e.g.
  `"22 - 29 June 2026"` for multi-day events.
- `location` — venue and city, or leave as `"Online"` for online events.
- `categories` — a list of tags. Use one or more of `Online Events`,
  `Seminars`, `Summer School` so the event shows up under the right filter
  button on the Events page, **plus** `Upcoming` or `Past` so those filter
  chips work too, e.g. `categories: [Seminars, Upcoming]`.

There's no need to move an event from "Upcoming" to "Past" — just update its
`categories` tag once it has happened (or leave it; it will keep sorting
correctly by date either way).

## Edit the People directory

People are listed in a single spreadsheet-style file, `people/people.csv`,
with one row per person and columns: `name, title, institution, photo,
profile_url`.

- Open `people/people.csv` (works in Excel, Google Sheets, Numbers, or
  GitHub's built-in editor).
- Add/edit/remove rows. Leave `photo` blank to use a generic placeholder
  avatar, or add a photo to `images/people/` and reference it starting with
  a `/`, e.g. `/images/people/jane-example.jpg`. Leave `profile_url` blank
  if the person doesn't have a profile page.
- Save as CSV and commit.

**Importing from the Google Form/Sheet:** once that's ready, export the
Google Sheet as CSV (File → Download → Comma-separated values), rename the
columns to match `name, title, institution, photo, profile_url` (or edit
`people/index.qmd` if you'd rather keep the sheet's own column names), and
replace `people/people.csv` with the export.

## Edit Training or Contact page text

`training/index.qmd` and `contact/index.qmd` are edited directly — open the
file, change the text/tables, commit. There's no template for these since
the content is mostly one-off per cohort/announcement rather than a
repeating list.

## Change the logo, favicon, or colours

- Logo/favicon: replace the files in `images/logos/` (keep the same
  filenames, or update the two references in `_quarto.yml` under
  `website.navbar.logo` / `website.favicon`).
- Brand colour: change the `$midsea-purple` value at the top of
  `styles.scss` — everything else (navbar, links, buttons) follows from it.

## Site navigation (the tabs across the top)

Edit the `website.navbar.left` list in `_quarto.yml` to add, remove, or
reorder tabs.
