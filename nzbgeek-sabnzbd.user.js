// ==UserScript==
// @name         NZBGeek → SABnzbd+ Sender
// @namespace    https://nzbgeek.info/
// @version      1.1.0
// @description  Adds a "Send to SABnzbd+" button next to every "Download NZB" button on NZBGeek movies/tv/games/audio/books/pc/xxx pages. The NZB is sent to SABnzbd with the release's top-level NZBGeek category (movies, tv, games, audio, books, pc, xxx).
// @match        https://nzbgeek.info/*
// @grant        GM_xmlhttpRequest
// @connect      sabnzbd.home
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ---------------------------------------------------------------- config
  // Replace these with your own values BEFORE installing:
  //  - baseUrl: your SABnzbd host (host:port), e.g. 'http://localhost:8080/api'
  //  - apikey:  SABnzbd -> Config -> General -> Security -> API Key
  const SAB = {
    baseUrl: 'http://sabnzbd.home/api',
    apikey: 'REPLACE_WITH_YOUR_SABNZBD_API_KEY',
  };

  // NZBGeek top-level category id (first digit of the 4-digit category code)
  // -> SABnzbd category name.
  const TOP_CAT = {
    1: 'games',
    2: 'movies',
    3: 'audio',
    4: 'pc',
    5: 'tv',
    6: 'xxx',
    7: 'books',
  };

  const TOP_CAT_NAMES = new Set(Object.values(TOP_CAT));
  const TEXT_ALIASES = { console: 'games' }; // "Games" is the usual label, be lenient
  const ICON_OK = 'fas fa-check';
  const ICON_ERR = 'fas fa-exclamation-triangle';
  const ICON_IDLE = 'fas fa-bolt';
  const FLASH_MS = 2500;

  // ------------------------------------------------------------------ css
  const style = document.createElement('style');
  style.textContent = `
    .sab_btn { margin: 0 !important; }
    .sab_btn.sab_sending { opacity: .45; pointer-events: none; }
    .sab_btn.sab_ok i { color: #46b450 !important; }
    .sab_btn.sab_err i { color: #e05252 !important; }
    .sab_btn i { pointer-events: none; }
  `;
  document.documentElement.appendChild(style);

  // ------------------------------------------------------- category logic
  function catFromCode(href) {
    const m = /(?:[?&])c=(\d{4})/.exec(href);
    if (m) return TOP_CAT[m[1][0]] || null;
    return null;
  }

  function catFromText(text) {
    const first = text.split('>')[0].trim().toLowerCase();
    const name = TEXT_ALIASES[first] || first;
    return TOP_CAT_NAMES.has(name) ? name : null;
  }

  /**
   * Resolve the SABnzbd category for a given NZB link.
   * 1) listing pages: the release row's category cell ("TV > HD" -> c=5040)
   * 2) release detail pages: the "Category:" row in the overlay
   * 3) page URL c= parameter
   * 4) SABnzbd default ("*")
   */
  function getCategory(nzbLink) {
    // 1) listing: tr.releases holds the category cell for this release
    const row = nzbLink.closest('tr.releases');
    if (row) {
      const catA = row.querySelector('td.releases_category a[href*="c="]');
      if (catA) {
        const cat = catFromCode(catA.getAttribute('href'));
        if (cat) return cat;
      }
    }

    // 2) detail page: "Category:" label row
    const scope = nzbLink.closest('table');
    const scan = (root) => {
      for (const td of root.querySelectorAll('td')) {
        if (td.textContent.trim() === 'Category:') {
          const valTd = td.nextElementSibling;
          if (valTd) {
            const cat = catFromText(valTd.textContent);
            if (cat) return cat;
          }
        }
      }
      return null;
    };
    if (scope) {
      const cat = scan(scope);
      if (cat) return cat;
    }
    const catDoc = scan(document);
    if (catDoc) return catDoc;

    // 3) page URL
    const cat = catFromCode(location.search);
    if (cat) return cat;

    // 4) SABnzbd default category
    return '*';
  }

  // -------------------------------------------------------------- sending
  function sendToSab(nzbLink, btn) {
    if (btn.classList.contains('sab_sending')) return;
    btn.classList.add('sab_sending');

    const cat = getCategory(nzbLink);
    const qs = new URLSearchParams({
      mode: 'addurl',
      name: nzbLink.href,
      cat: cat,
      apikey: SAB.apikey,
      output: 'json',
    });
    const url = SAB.baseUrl + '?' + qs.toString();

    const finish = (ok) => {
      btn.classList.remove('sab_sending');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = ok ? ICON_OK : ICON_ERR;
      }
      btn.title = ok
        ? `Sent to SABnzbd+ (category: ${cat})`
        : 'SABnzbd+ send FAILED — check that SABnzbd is reachable';
      btn.classList.add(ok ? 'sab_ok' : 'sab_err');
      setTimeout(() => {
        btn.classList.remove('sab_ok', 'sab_err');
        const i = btn.querySelector('i');
        if (i) i.className = ICON_IDLE;
        btn.title = `Send to SABnzbd+ (category: ${cat})`;
      }, FLASH_MS);
    };

    GM_xmlhttpRequest({
      method: 'GET',
      url: url,
      timeout: 30000,
      onload: (resp) => {
        let ok = false;
        try {
          ok = JSON.parse(resp.responseText).status === true;
        } catch (e) { /* not json -> failure */ }
        finish(ok);
      },
      onerror: () => finish(false),
      ontimeout: () => finish(false),
    });
  }

  // --------------------------------------------------------------- button
  function addSabButton(nzbLink) {
    if (nzbLink.dataset.sabAttached) return;
    nzbLink.dataset.sabAttached = '1';

    const btn = document.createElement('span');
    btn.className = nzbLink.className + ' sab_btn'; // releases_icons / releases_icons_medium
    btn.title = 'Send to SABnzbd+';
    btn.style.cursor = 'pointer';
    btn.innerHTML = `<i class="${ICON_IDLE}"></i>`;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendToSab(nzbLink, btn);
    });
    nzbLink.insertAdjacentElement('beforebegin', btn); // left of the Download NZB icon
  }

  function attachAll() {
    document
      .querySelectorAll('a[title="Download NZB"]')
      .forEach((link) => {
        // Listing rows also contain a legacy sprite placeholder (div.icon_nzb)
        // whose anchor is empty and invisible — skip it so only ONE button is
        // added per release, next to the real rendered Download NZB icon.
        if (link.querySelector('i')) addSabButton(link);
      });
  }

  // ---------------------------------------------------------------- init
  attachAll();

  // Catch releases loaded dynamically (overlays, "view more", etc.)
  let scanQueued = false;
  const observer = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      attachAll();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
