// TDN Release Notes widget (GitHub RAW -> render as <pre>)
// Designed to be loaded via <script src="..."> to avoid Confluence/TDN mangling inline JS.
//
// Repo hosting this file (and the *.txt release notes):
//   https://github.com/Juansimeoni/ReleaseDatasul
//
// Expected file name:
//   {version}.txt  (e.g. 12.1.2503.14.txt)
//
// NOTE: Keep this file plain JS (no HTML entities) and host it on GitHub RAW.
(function () {
  try {
    // #region agent log (debug-session)
    function __rnlog(hypothesisId, location, message, data) {
      try {
        fetch('http://127.0.0.1:7242/ingest/2da23971-14ba-4513-a0c7-5c1989cfafda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'run1', hypothesisId: hypothesisId, location: location, message: message, data: data || {}, timestamp: Date.now() }) }).catch(function () {});
      } catch (e) {}
    }
    // #endregion agent log (debug-session)

    __rnlog('A', 'tdn_release_widget.js:boot', 'script_start', { hasFetch: typeof fetch, href: String(location && location.href || '') });

    var GITHUB_OWNER = 'Juansimeoni';
    var GITHUB_REPO = 'ReleaseDatasul';
    var GITHUB_BRANCH = 'main';
    var GITHUB_PATH_PREFIX = ''; // optional folder inside repo (no leading/trailing slash)

    var RAW_BASE = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/' + GITHUB_BRANCH + '/';
    var API_BASE = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/';

    function buildRepoPath(version) {
      var filename = version + '.txt';
      return GITHUB_PATH_PREFIX ? (GITHUB_PATH_PREFIX + '/' + filename) : filename;
    }

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, text) {
      var el = byId(id);
      if (el) el.textContent = (text == null ? '-' : String(text));
    }

    function formatDatePtBr(value) {
      try {
        var d = new Date(value);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleString('pt-BR');
      } catch (e) {
        return null;
      }
    }

    function getPageVersion() {
      var versionPattern = /(\d+\.\d+\.\d+(?:\.\d+)?)/;

      var pageTitleElement = document.querySelector('h1#title-text, .page-title, h1, [data-page-title]');
      if (pageTitleElement) {
        var titleText = (pageTitleElement.textContent || '').trim();
        var m1 = titleText.match(versionPattern);
        if (m1) return m1[1];
      }

      var metaTitle = document.querySelector('meta[property="og:title"], meta[name="title"]');
      if (metaTitle) {
        var c = metaTitle.getAttribute('content') || '';
        var m2 = c.match(versionPattern);
        if (m2) return m2[1];
      }

      var m3 = (document.title || '').match(versionPattern);
      if (m3) return m3[1];
      return null;
    }

    function getPageId() {
      try {
        var qs = new URLSearchParams(window.location.search);
        var fromQuery = qs.get('pageId');
        if (fromQuery) return String(fromQuery);
      } catch (e) {}

      try {
        if (window.AJS && AJS.params && AJS.params.pageId) return String(AJS.params.pageId);
      } catch (e) {}

      return null;
    }

    function setTotvsLogo() {
      var logoEl = byId('totvs-logo');
      if (!logoEl) return;

      var pageId = getPageId();
      var filename = 'totvs logo.jpg';
      var encodedName = encodeURIComponent(filename);

      var candidates = [];
      if (pageId) {
        candidates.push('/download/thumbnails/' + pageId + '/' + encodedName + '?api=v2');
        candidates.push('/download/attachments/' + pageId + '/' + encodedName);
      }
      candidates.push('/download/attachments/649987902/' + encodedName);

      var idx = 0;
      function tryNext() {
        if (idx >= candidates.length) return;
        var url = candidates[idx++];
        var probe = new Image();
        probe.onload = function () {
          logoEl.src = url;
          logoEl.style.display = 'inline-block';
        };
        probe.onerror = function () {
          tryNext();
        };
        probe.src = url;
      }

      tryNext();
    }

    function getVersionOverrideFromQuery() {
      try {
        var qs = new URLSearchParams(window.location.search);
        var v = qs.get('version') || qs.get('versao');
        if (v && /^\d+\.\d+\.\d+(?:\.\d+)?$/.test(v)) return v;
      } catch (e) {}
      return null;
    }

    function tryFetchCommitDate(pathInRepo) {
      // Use a safe querystring builder (avoid '&' issues in some environments)
      var url = API_BASE + 'commits?path=' + encodeURIComponent(pathInRepo) +
        '&sha=' + encodeURIComponent(GITHUB_BRANCH) + '&per_page=1';

      return fetch(url, { cache: 'no-store' })
        .then(function (resp) {
          if (!resp.ok) return null;
          return resp.json();
        })
        .then(function (arr) {
          if (!arr || !arr.length) return null;
          var c = arr[0] || {};
          var commit = c.commit || {};
          var committer = commit.committer || {};
          var author = commit.author || {};
          return committer.date || author.date || null;
        })
        .catch(function () { return null; });
    }

    function renderNotAvailable(container) {
      __rnlog('D', 'tdn_release_widget.js:renderNotAvailable', 'render_not_available', {});
      container.innerHTML =
        '<div style="padding:18px; border-left:4px solid #FFAB00; background:#FFFAE6; color:#172b4d;">' +
          '<div style="font-weight:700;">Esse documento ainda não está disponível no momento.</div>' +
        '</div>';
    }

    var container = byId('widget-container');
    if (!container) {
      __rnlog('C', 'tdn_release_widget.js:container', 'container_not_found', { ids: { widget: !!byId('widget-container'), version: !!byId('version-display'), last: !!byId('last-update') } });
      return;
    }
    __rnlog('C', 'tdn_release_widget.js:container', 'container_found', { ids: { version: !!byId('version-display'), last: !!byId('last-update') } });

    // Try to show logo (optional)
    setTotvsLogo();

    var versionResolved = getVersionOverrideFromQuery() || getPageVersion();
    if (!versionResolved) {
      __rnlog('C', 'tdn_release_widget.js:version', 'version_not_resolved', { title: String(document && document.title || '') });
      container.innerHTML =
        '<div style="padding:18px; border-left:4px solid #DE350B; background:#FFEBE6; color:#172b4d;">' +
          '<div style="font-weight:700; margin-bottom:6px;">Versão não identificada</div>' +
          '<div>Coloque a versão no título da página, ex: <b>Dicionário de Dados 12.1.2503.14</b></div>' +
        '</div>';
      return;
    }
    __rnlog('C', 'tdn_release_widget.js:version', 'version_resolved', { version: versionResolved });

    setText('version-display', versionResolved);
    var titleEl = byId('page-title');
    if (titleEl) titleEl.textContent = 'Dicionário de Dados ' + versionResolved;

    setText('last-update', 'Carregando...');
    container.innerHTML = '<div style="padding:18px; color:#6b778c;">Carregando conteúdo do GitHub...</div>';

    var pathInRepo = buildRepoPath(versionResolved);
    var rawUrl = RAW_BASE + pathInRepo;
    __rnlog('B', 'tdn_release_widget.js:fetch', 'starting_fetch', { rawUrl: rawUrl, pathInRepo: pathInRepo });

    Promise.all([
      fetch(rawUrl, { cache: 'no-store' }),
      tryFetchCommitDate(pathInRepo)
    ]).then(function (pair) {
      var rawResp = pair[0];
      var commitIso = pair[1];

      __rnlog('B', 'tdn_release_widget.js:fetch', 'fetch_done', { rawOk: !!(rawResp && rawResp.ok), rawStatus: rawResp ? rawResp.status : null, commitIso: commitIso ? String(commitIso) : null });
      if (!rawResp || !rawResp.ok) {
        setText('last-update', 'N/A');
        renderNotAvailable(container);
        return;
      }

      rawResp.text().then(function (t) {
        var content = (t || '').trim();
        __rnlog('B', 'tdn_release_widget.js:fetch', 'raw_text_read', { length: content.length });
        if (!content) {
          setText('last-update', 'N/A');
          renderNotAvailable(container);
          return;
        }

        var lastModifiedHeader = rawResp.headers ? rawResp.headers.get('Last-Modified') : null;
        var dateText = null;
        if (commitIso) dateText = formatDatePtBr(commitIso);
        if (!dateText && lastModifiedHeader) dateText = formatDatePtBr(lastModifiedHeader);
        setText('last-update', dateText || 'N/A');

        var pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '0';
        pre.style.padding = '16px';
        pre.style.borderTop = '1px solid #dfe1e6';
        pre.style.fontFamily = 'Consolas, Menlo, Monaco, "Courier New", monospace';
        pre.textContent = content;

        container.innerHTML = '';
        container.appendChild(pre);
      }).catch(function () {
        __rnlog('E', 'tdn_release_widget.js:fetch', 'raw_text_error', {});
        setText('last-update', 'Erro');
        renderNotAvailable(container);
      });
    }).catch(function () {
      __rnlog('E', 'tdn_release_widget.js:fetch', 'promise_all_error', {});
      setText('last-update', 'Erro');
      renderNotAvailable(container);
    });
  } catch (e) {
    __rnlog('E', 'tdn_release_widget.js:boot', 'top_level_exception', { name: e && e.name ? String(e.name) : null, msg: e && e.message ? String(e.message) : null });
    // If something goes very wrong, fail silently to avoid breaking the page.
  }
})();


