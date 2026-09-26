/**
 * Google Apps Script bound to the MIDSEA "Member applications" Google Sheet.
 *
 * Flow:
 *   1. The website form (people/apply.qmd) POSTs each application to this
 *      script's web app URL. doPost() appends a row with Status "Pending"
 *      and saves the photo (already resized by the browser) to Drive.
 *   2. A maintainer sets Status to "Approved" in the Sheet. onStatusEdit()
 *      sends a `repository_dispatch` event ("add-person") to GitHub.
 *   3. .github/workflows/add-person.yml writes the row to people/people.csv
 *      and the photo, opens a PR, waits for the render check, and merges.
 *      The merge republishes the site.
 *
 * Anyone with edit access to the Sheet can approve, so share it only with
 * maintainers.
 *
 * Setup (once):
 *   1. Create a Google Sheet. Extensions -> Apps Script. Paste this file.
 *   2. Project Settings -> Script properties -> add GITHUB_TOKEN: a
 *      fine-grained PAT, only for this repo, "Contents: Read and write".
 *   3. Run setup() and accept the permission prompts. It adds the
 *      Applications tab, the Drive photo folder, and the edit trigger.
 *   4. Deploy -> New deployment -> Web app. Execute as: Me. Who has access:
 *      Anyone. Copy the /exec URL into ENDPOINT in people/apply.qmd.
 *   5. After a later change to this file: Deploy -> Manage deployments ->
 *      Edit -> Version: New version. The URL stays the same.
 */

const CONFIG = {
  owner: 'MIDSEA-Network',
  repo: 'midsea-network',
  eventType: 'add-person',
  sheetName: 'Applications',
  photoFolderName: 'MIDSEA applicant photos',
  // GitHub rejects a dispatch payload of 64 KB or more. The website form
  // shrinks photos to fit maxPhotoB64; this is a server-side backstop.
  maxPhotoB64: 50000,
  maxPayloadBytes: 60000,
  maxLen: 200,
  // Who gets an email when a dispatch fails. Blank = the script owner.
  notifyEmail: '',
};

const STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

// Columns are found by header text, so they can be reordered in the Sheet.
const COLS = {
  submitted: 'Submitted',
  name: 'Name',
  email: 'Email',
  title: 'Title',
  institution: 'Institution',
  profile_url: 'Profile URL',
  photo_id: 'Photo file ID',
  status: 'Status',
  sent: 'Sent to GitHub',
  note: 'Note',
};

// ---------------------------------------------------------------- setup

function setup() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    sheet.appendRow(Object.values(COLS));
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  }
  const statusCol = colIndex_(sheet, COLS.status);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(STATUS), true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusCol, sheet.getMaxRows() - 1, 1).setDataValidation(rule);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PHOTO_FOLDER_ID')) {
    props.setProperty('PHOTO_FOLDER_ID', DriveApp.createFolder(CONFIG.photoFolderName).getId());
  }

  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onStatusEdit')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  // An installable trigger, because a simple onEdit cannot call UrlFetchApp.
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MIDSEA')
    .addItem('Send approved rows not yet sent', 'sendPendingApproved')
    .addItem('Resend selected rows', 'resendSelected')
    .addToUi();
}

// ---------------------------------------------------------------- website form

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    // Honeypot: the form hides this field from people; bots fill it in.
    // Answer "ok" so the bot does not retry.
    if (data.website) return json_({ ok: true });
    addApplication_(data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: err.message || String(err) });
  }
}

function addApplication_(data) {
  const app = {
    name: text_(data.name),
    email: text_(data.email).toLowerCase(),
    title: text_(data.title),
    institution: text_(data.institution),
    profile_url: text_(data.profile_url),
  };
  if (!app.name) throw new Error('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.email)) {
    throw new Error('Please enter a valid email address.');
  }
  if (app.profile_url && !/^https?:\/\//i.test(app.profile_url)) {
    throw new Error('The profile link must start with http:// or https://.');
  }
  if (data.consent !== true) throw new Error('Please tick the consent box.');

  let photoId = '';
  if (data.photo_b64) photoId = savePhoto_(data.photo_b64, app.name);

  const sheet = sheet_();
  const row = headers_(sheet).map((h) => {
    switch (h) {
      case COLS.submitted: return new Date();
      case COLS.name: return cell_(app.name);
      case COLS.email: return cell_(app.email);
      case COLS.title: return cell_(app.title);
      case COLS.institution: return cell_(app.institution);
      case COLS.profile_url: return cell_(app.profile_url);
      case COLS.photo_id: return photoId;
      case COLS.status: return STATUS.pending;
      default: return '';
    }
  });
  sheet.appendRow(row);
}

function savePhoto_(b64, name) {
  if (typeof b64 !== 'string' || b64.length > CONFIG.maxPhotoB64) {
    throw new Error('The photo is too large. Please choose a smaller image.');
  }
  const bytes = Utilities.base64Decode(b64);
  // JPEG magic bytes FF D8 FF (Apps Script bytes are signed).
  if (bytes.length < 3 || bytes[0] !== -1 || bytes[1] !== -40 || bytes[2] !== -1) {
    throw new Error('The photo is not a JPEG image.');
  }
  const folderId = PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID');
  if (!folderId) throw new Error('Server not set up: run setup() first.');
  const stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss");
  const blob = Utilities.newBlob(bytes, 'image/jpeg', `${stamp}-${name}.jpg`);
  return DriveApp.getFolderById(folderId).createFile(blob).getId();
}

// ---------------------------------------------------------------- approval

function onStatusEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.sheetName) return;
  const statusCol = colIndex_(sheet, COLS.status);
  if (e.range.getColumn() > statusCol || e.range.getLastColumn() < statusCol) return;

  for (let r = e.range.getRow(); r <= e.range.getLastRow(); r++) {
    if (r === 1) continue;
    if (sheet.getRange(r, statusCol).getValue() !== STATUS.approved) continue;
    if (sheet.getRange(r, colIndex_(sheet, COLS.sent)).getValue()) continue;
    sendRowSafely_(sheet, r);
  }
}

/** Menu: retry path, and bulk path for rows approved before setup(). */
function sendPendingApproved() {
  const sheet = sheet_();
  const statusCol = colIndex_(sheet, COLS.status);
  const sentCol = colIndex_(sheet, COLS.sent);
  const values = sheet.getDataRange().getValues();
  // Each dispatch starts one workflow run; the workflow's concurrency group
  // runs them one after another.
  for (let i = 1; i < values.length; i++) {
    if (values[i][statusCol - 1] === STATUS.approved && !values[i][sentCol - 1]) {
      sendRowSafely_(sheet, i + 1);
    }
  }
}

/** Menu: send the selected rows again, e.g. after fixing a typo in the Sheet. */
function resendSelected() {
  const sheet = sheet_();
  const range = sheet.getActiveRange();
  if (!range || range.getSheet().getName() !== CONFIG.sheetName) return;
  const statusCol = colIndex_(sheet, COLS.status);
  for (let r = Math.max(2, range.getRow()); r <= range.getLastRow(); r++) {
    if (sheet.getRange(r, statusCol).getValue() === STATUS.approved) sendRowSafely_(sheet, r);
  }
}

function sendRowSafely_(sheet, r) {
  const sentCell = sheet.getRange(r, colIndex_(sheet, COLS.sent));
  const noteCell = sheet.getRange(r, colIndex_(sheet, COLS.note));
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sendRow_(sheet, r);
    sentCell.setValue(new Date());
    noteCell.setValue('');
  } catch (err) {
    sentCell.setValue('');
    noteCell.setValue(`Failed: ${err.message || err}`);
    const to = CONFIG.notifyEmail || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail(
      to,
      'MIDSEA applications: approved row not sent to GitHub',
      `Sheet row ${r}\n\n${err.stack || err}\n\n` +
        'Fix the cause, then use the MIDSEA menu -> "Send approved rows not yet sent".'
    );
  } finally {
    lock.releaseLock();
  }
}

function sendRow_(sheet, r) {
  const headers = headers_(sheet);
  const values = sheet.getRange(r, 1, 1, headers.length).getValues()[0];
  const get = (col) => text_(values[headers.indexOf(col)]);

  const payload = {
    name: uncell_(get(COLS.name)),
    title: uncell_(get(COLS.title)),
    institution: uncell_(get(COLS.institution)),
    profile_url: uncell_(get(COLS.profile_url)),
    // Only the hash leaves Google: people.csv is public. Gravatar looks up
    // avatars by the same hash, and it matches resubmissions to a row.
    email_sha256: sha256Hex_(uncell_(get(COLS.email)).toLowerCase()),
  };
  if (!payload.name) throw new Error('Row has no name.');

  const photoId = get(COLS.photo_id);
  if (photoId) {
    const blob = DriveApp.getFileById(photoId).getBlob();
    payload.photo_b64 = Utilities.base64Encode(blob.getBytes());
    payload.photo_type = 'image/jpeg';
  }

  const json = JSON.stringify({ event_type: CONFIG.eventType, client_payload: payload });
  if (Utilities.newBlob(json).getBytes().length > CONFIG.maxPayloadBytes) {
    throw new Error(`Payload too large for GitHub (photo ${photoId}).`);
  }
  dispatch_(json);
}

function dispatch_(json) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Script property GITHUB_TOKEN is not set.');

  const res = UrlFetchApp.fetch(
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/dispatches`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      payload: json,
      muteHttpExceptions: true,
    }
  );
  // GitHub answers 204 No Content on success.
  if (res.getResponseCode() !== 204) {
    throw new Error(`GitHub dispatch failed (${res.getResponseCode()}): ${res.getContentText()}`);
  }
}

// ---------------------------------------------------------------- helpers

function sheet_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.sheetName);
  if (!sheet) throw new Error('Server not set up: run setup() first.');
  return sheet;
}

function headers_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function colIndex_(sheet, header) {
  const i = headers_(sheet).indexOf(header);
  if (i < 0) throw new Error(`Column "${header}" is missing from the Sheet.`);
  return i + 1;
}

// A cell that starts with = + - @ runs as a formula. Prefix a quote so a
// public submission cannot inject one; uncell_() strips it when sending.
function cell_(value) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function uncell_(value) {
  return value.replace(/^'(?=[=+\-@])/, '');
}

function text_(value) {
  return value == null ? '' : String(value).trim().replace(/\s+/g, ' ').slice(0, CONFIG.maxLen);
}

function sha256Hex_(text) {
  if (!text) return '';
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
