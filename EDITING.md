# Editing the MIDSEA Network website

This site uses [Quarto](https://quarto.org). You do **not** need to know how
to code to update most content. Each content item is a plain text file. A few
`field: value` lines at the top work like a form.

For small edits, use GitHub in your browser. You do not need to install
software:

1. Open the file you want to change on the repository's GitHub page.
2. Click the pencil icon ("Edit this file").
3. Make your change.
4. Scroll down. Write a short message that describes the change. Click
   "Commit changes directly to the `main` branch."
5. Wait 2-3 minutes. The site rebuilds and publishes automatically. You do
   not need to do anything else.

To work on your computer instead, install Quarto
(<https://quarto.org/docs/get-started/>). Then run `quarto preview` in the
project folder to see your changes before you commit or push.

---

## Add a news item

1. Open the `_templates/news-template.qmd` file.
2. Copy it into the `news/` folder. Give it a new name, for example
   `news/2026-03-my-update.qmd`. The filename does not matter much, but a
   date at the start keeps the folder tidy.
3. Fill in the fields at the top of the file:
   - `title` — the headline on the News page
   - `date` — the date in `YYYY-MM-DD` format. The site sorts by this date.
   - `image` — the path to a photo. Add the photo file to `images/news/`
     first.
   - `description` — one or two sentences. The card shows these sentences.
4. Write the full story below the `---` line.
5. Commit. The News page and Home page show the new item automatically,
   newest first.

## Add an event

Same method. Copy `_templates/event-template.qmd` into `events/`:

- `title`, `date` (`YYYY-MM-DD`, used for sorting), `image`, `description` —
  same as news.
- `event-dates` — the date text on the card, for example
  `"22 - 29 June 2026"` for multi-day events.
- `location` — the venue and city. Use `"Online"` for online events.
- `categories` — a list of tags. Use one or more of `Online Events`,
  `Seminars`, `Summer School` so the event appears under the correct filter
  button on the Events page. Also add `Upcoming` or `Past` so the filter
  chips work. Example: `categories: [Seminars, Upcoming]`.

You do not need to move an event from "Upcoming" to "Past". After the event,
update its `categories` tag. (Or leave the tag. The site sorts by date in
both cases.)

## Add a training programme

Same method again. Copy `_templates/training-template.qmd` into `training/`:

- `title`, `date` (`YYYY-MM-DD`, used for sorting), `event-dates`,
  `location`, `image`, `description` — same meaning as for events.
- Write the full programme details below the `---` line: what's included,
  the schedule, fees, scholarships, and how to register. Use or delete the
  template's section headings as needed — not every programme has
  scholarships, for example.

## Edit the People directory

The file `people/people.csv` lists all people. It is a spreadsheet-style
file with one row per person. The columns are `name, title, institution,
photo, profile_url, email_sha256`.

- Open `people/people.csv` (Excel, Google Sheets, Numbers, and GitHub's
  built-in editor all work).
- Add, edit, or remove rows. Leave `profile_url` blank if the person does
  not have a profile page.
- Profile picture, in order of preference:
  - Add a photo to `images/people/`. In `photo`, write the path with a `/`
    at the start, for example `/images/people/jane-example.jpg`.
  - Otherwise, the site shows the person's [Gravatar](https://gravatar.com),
    if they set one up. A Gravatar is the avatar tied to their email at
    gravatar.com. The application form fills in `email_sha256` for this. It is a
    scrambled code made from the email, not the email itself.
  - Never type a real email address into `people.csv`. The file is public
    on the website. Leave `email_sha256` blank when you add a row by hand.
  - If `photo` and `email_sha256` are blank, or the person has no Gravatar,
    the site shows a generic placeholder avatar.
- Save as CSV and commit.

**Member applications:** People apply on the website, at
People → "Apply to join the directory". Each application lands in the
applications Google Sheet with Status `Pending`. To publish one:

1. Open the Sheet and check the row.
2. Change Status to `Approved`. Within a few minutes the person is added
   (or updated, if they applied before with the same email) and the site
   republishes. The `Sent to GitHub` column shows when it went.
3. To turn down an application, set Status to `Rejected`. Nothing is
   published.

If `Note` shows "Failed", the Sheet owner also gets an email. Fix the
cause, then use the Sheet menu MIDSEA → "Send approved rows not yet sent".
To correct a published person, fix the row in the Sheet, select it, and
use MIDSEA → "Resend selected rows".

Do not export the Sheet into `people.csv`. The Sheet contains plain email
addresses.

## Edit the Contact page text

You edit `contact/index.qmd` directly. Open the file, change the text, and
commit. This page has no template because its content is one-off, not a
repeating list.

## Change the logo, the favicon, or the colours

- Logo/favicon: replace the files in `images/logos/`. Keep the same
  filenames. If you use new filenames, update the two references in
  `_quarto.yml` under `website.navbar.logo` and `website.favicon`.
- Brand colour: change the `$midsea-purple` value at the top of
  `styles.scss`. Everything else (navbar, links, buttons) follows from it.

## Site navigation (the tabs across the top)

Edit the `website.navbar.left` list in `_quarto.yml` to add, remove, or
reorder tabs.
