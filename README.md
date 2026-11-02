# tampermonkey-nzbgeek-arr

A [Tampermonkey](https://www.tampermonkey.net/) userscript that adds a **⚡ Send to SABnzbd+** button to [NZBGeek](https://nzbgeek.info/), right next to (and left of) every **Download NZB** button.

Click it and the release's NZB is sent straight to SABnzbd — no downloading and re-uploading, no Sonarr/Radarr search needed for manual grabs.

## Features

- Works on all NZBGeek browse/search pages: `movies`, `tv`, `games`, `audio`, `books`, `pc`, `xxx` (plus mixed-category searches) and on release detail pages.
- Automatically sets the SABnzbd category to the release's **top-level NZBGeek category** (`movies`, `tv`, `games`, `audio`, `books`, `pc`, `xxx`).
- Reads the NZB URL from the existing Download NZB link, so no NZBGeek credentials are needed in the script.
- Visual feedback: icon flashes green ✓ when accepted, red ⚠ on failure, with the category shown in the tooltip.

## Requirements

- Tampermonkey (Safari, Chrome, Firefox, Edge — all fine).
- SABnzbd reachable from your browser over HTTP/HTTPS (e.g. `http://sabnzbd.home` or `http://localhost:8080`).
- An active NZBGeek account (the script only needs you to be logged in on the site).

## Installation

1. Open Tampermonkey → **Dashboard** → **+** (add new script).
2. Paste the contents of [`nzbgeek-sabnzbd.user.js`](nzbgeek-sabnzbd.user.js), save.
3. Reload NZBGeek — the ⚡ button appears left of each ☁ Download NZB icon.

### Configuration

Before saving, edit the `SAB` block at the top of the script:

```js
const SAB = {
  baseUrl: 'http://sabnzbd.home/api',           // your SABnzbd host:port
  apikey: 'REPLACE_WITH_YOUR_SABNZBD_API_KEY', // SABnzbd -> Config -> General -> Security -> API Key
};
```

> **Keep your key private.** This repository intentionally ships a placeholder. If you keep a local copy of the script with your real key in it, make sure it never gets committed (the bundled `.gitignore` already excludes `nzbgeek-sabnzbd.local.user.js`).

### SABnzbd categories

The script sends the top-level NZBGeek category name as the SABnzbd `cat`. Make sure these categories exist in SABnzbd (**Config → Categories**): `movies`, `tv`, `games`, `audio`, `books`, `pc`, `xxx`.

You can create them via the API (one call per category):

```bash
curl "http://SABNZBD_HOST/api?mode=set_config&section=categories&cat=games&name=games&apikey=YOUR_API_KEY"
```

## Category mapping

The release's 4-digit NZBGeek category id maps to the SABnzbd category by its first digit:

| NZBGeek category id | SABnzbd category |
| ------------------- | ---------------- |
| `1xxx` (Games)      | `games`          |
| `2xxx` (Movies)     | `movies`         |
| `3xxx` (Audio)      | `audio`          |
| `4xxx` (PC)         | `pc`             |
| `5xxx` (TV)         | `tv`             |
| `6xxx` (XXX)        | `xxx`             |
| `7xxx` (Books)      | `books`          |

On listing pages the category is read from the release row's own category cell, so mixed-category searches still land each release in the right place. On detail pages it's read from the release overlay. If no category can be determined, SABnzbd's default (`*`) is used.

## How it works

1. The script reads the NZB URL from the existing Download NZB link (`api.nzbgeek.info/cdn?t=get&id=...`), which already carries your NZBGeek session key.
2. It calls SABnzbd's [`addurl` API](https://sabnzbd.org/wiki/configuration/5.1/api): `mode=addurl&name=<nzb url>&cat=<category>&apikey=<key>`.
3. SABnzbd fetches the NZB from the Geek CDN itself and queues the job under the mapped category.

The request is made with `GM_xmlhttpRequest`, because plain `fetch()` from the https NZBGeek page to an http SABnzbd host is blocked by browsers' mixed-content policy (and CORS).

## Troubleshooting

- **Red ⚠ flash on click** — SABnzbd unreachable, wrong API key, or wrong `baseUrl`. Check the tooltip; verify the `SAB` config block.
- **Job added but then fails in SABnzbd** — `addurl` is asynchronous: SABnzbd accepts the job first, then fetches the NZB. Check SABnzbd's queue/history for the fetch error.
- **No ⚡ buttons** — make sure the script is enabled in Tampermonkey and you're logged in to NZBGeek.
- **Two buttons per row** — you're running an old version (< 1.1.0). Update to the latest.
