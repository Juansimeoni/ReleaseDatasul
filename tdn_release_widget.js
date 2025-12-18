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
      container.innerHTML =
        '<div style="padding:18px; border-left:4px solid #FFAB00; background:#FFFAE6; color:#172b4d;">' +
          '<div style="font-weight:700;">Esse documento ainda não está disponível no momento.</div>' +
        '</div>';
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // Render a tiny, safe Markdown-ish subset to improve readability in TDN.
    // Supported:
    // - # / ## / ### headings
    // - "- " bullets
    // - **bold**
    // - `inline code`
    function renderMarkup(container, contentText) {
      var lines = String(contentText || '').replace(/\r\n/g, '\n').split('\n');
      var out = [];
      var inList = false;

      function closeList() {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
      }

      function inlineFormat(escapedLine) {
        // **bold**
        escapedLine = escapedLine.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // `code`
        escapedLine = escapedLine.replace(/`([^`]+)`/g, '<code style="background:#f4f5f7; padding:1px 4px; border-radius:4px; font-family: Consolas, Menlo, Monaco, &quot;Courier New&quot;, monospace;">$1</code>');
        return escapedLine;
      }

      for (var i = 0; i < lines.length; i++) {
        var raw = lines[i];
        var line = raw == null ? '' : String(raw);

        if (!line.trim()) {
          closeList();
          out.push('<div style="height:10px;"></div>');
          continue;
        }

        var esc = escapeHtml(line);
        if (esc.indexOf('### ') === 0) {
          closeList();
          out.push('<div style="padding:10px 16px 0; font-size:15px; font-weight:700; color:#172b4d;">' + inlineFormat(esc.slice(4)) + '</div>');
          continue;
        }
        if (esc.indexOf('## ') === 0) {
          closeList();
          out.push('<div style="padding:12px 16px 0; font-size:16px; font-weight:800; color:#172b4d;">' + inlineFormat(esc.slice(3)) + '</div>');
          continue;
        }
        if (esc.indexOf('# ') === 0) {
          closeList();
          out.push('<div style="padding:14px 16px 4px; font-size:18px; font-weight:900; color:#172b4d;">' + inlineFormat(esc.slice(2)) + '</div>');
          continue;
        }

        if (esc.indexOf('- ') === 0) {
          if (!inList) {
            out.push('<ul style="margin:8px 0 8px 34px; padding:0; color:#172b4d; line-height:1.45;">');
            inList = true;
          }
          out.push('<li style="margin:4px 0;">' + inlineFormat(esc.slice(2)) + '</li>');
          continue;
        }

        closeList();
        out.push('<div style="padding:0 16px; color:#172b4d; line-height:1.55;">' + inlineFormat(esc) + '</div>');
      }

      closeList();
      container.innerHTML =
        '<div style="padding:10px 0 14px 0; background:#ffffff; border-top:1px solid #dfe1e6;">' +
          out.join('') +
        '</div>';
    }

    var container = byId('widget-container');
    if (!container) {
      return;
    }

    // Try to show logo (optional)
    setTotvsLogo();

    var versionResolved = getVersionOverrideFromQuery() || getPageVersion();
    if (!versionResolved) {
      container.innerHTML =
        '<div style="padding:18px; border-left:4px solid #DE350B; background:#FFEBE6; color:#172b4d;">' +
          '<div style="font-weight:700; margin-bottom:6px;">Versão não identificada</div>' +
          '<div>Coloque a versão no título da página, ex: <b>Dicionário de Dados 12.1.2503.14</b></div>' +
        '</div>';
      return;
    }

    setText('version-display', versionResolved);
    var titleEl = byId('page-title');
    if (titleEl) titleEl.textContent = 'Dicionário de Dados ' + versionResolved;

    setText('last-update', 'Carregando...');
    container.innerHTML = '<div style="padding:18px; color:#6b778c;">Carregando conteúdo do GitHub...</div>';

    var pathInRepo = buildRepoPath(versionResolved);
    var rawUrl = RAW_BASE + pathInRepo;

    Promise.all([
      fetch(rawUrl, { cache: 'no-store' }),
      tryFetchCommitDate(pathInRepo)
    ]).then(function (pair) {
      var rawResp = pair[0];
      var commitIso = pair[1];

      if (!rawResp || !rawResp.ok) {
        setText('last-update', 'N/A');
        renderNotAvailable(container);
        return;
      }

      rawResp.text().then(function (t) {
        var content = (t || '').trim();
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

              // If you want the old monospace behavior back, swap renderMarkup() with the <pre> below.
              // For readability, we render a safe Markdown-ish subset.
              renderMarkup(container, content);
      }).catch(function () {
        setText('last-update', 'Erro');
        renderNotAvailable(container);
      });
    }).catch(function () {
      setText('last-update', 'Erro');
      renderNotAvailable(container);
    });
  } catch (e) {
    // If something goes very wrong, fail silently to avoid breaking the page.
  }
})();


