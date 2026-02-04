/**
 * OrchestKit Playground Navigation
 * Injects a fixed top navigation bar into any playground page.
 * Requires data.js to be loaded first (window.ORCHESTKIT_DATA).
 */
(function() {
  'use strict';

  var data = window.ORCHESTKIT_DATA;

  // ─── URL Parameter Utilities ───────────────────────────────────────────────
  window.orkUrl = {
    getParams: function() {
      var params = {};
      var search = window.location.search.substring(1);
      if (!search) return params;
      var pairs = search.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (pair[0]) {
          params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
      }
      return params;
    },
    setParams: function(params) {
      var parts = [];
      for (var key in params) {
        if (params.hasOwnProperty(key) && params[key] !== null && params[key] !== '' && params[key] !== 'all') {
          parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
      }
      var newUrl = window.location.pathname + (parts.length ? '?' + parts.join('&') : '');
      window.history.replaceState(null, '', newUrl);
    },
    getCompUrl: function(compId, page) {
      var base = window.location.origin + window.location.pathname.replace(/[^\/]*$/, '');
      return base + (page || 'demo-gallery.html') + '?comp=' + encodeURIComponent(compId);
    }
  };

  // ─── Breadcrumb Utilities ──────────────────────────────────────────────────
  window.orkBreadcrumbs = {
    hierarchy: {
      'index.html': { label: 'Hub', parent: null },
      'demo-gallery.html': { label: 'Demo Gallery', parent: 'index.html' },
      'marketplace-explorer.html': { label: 'Marketplace', parent: 'index.html' },
      'setup-wizard.html': { label: 'Setup Wizard', parent: 'index.html' }
    },
    build: function(currentPage, activeItem) {
      var crumbs = [];
      var page = currentPage;
      while (page && this.hierarchy[page]) {
        crumbs.unshift({ href: page, label: this.hierarchy[page].label });
        page = this.hierarchy[page].parent;
      }
      if (activeItem) {
        crumbs.push({ href: null, label: activeItem, active: true });
      } else if (crumbs.length > 0) {
        crumbs[crumbs.length - 1].active = true;
      }
      return crumbs;
    },
    render: function(containerId, currentPage, activeItem) {
      var container = document.getElementById(containerId);
      if (!container) return;
      var crumbs = this.build(currentPage, activeItem);
      var html = crumbs.map(function(c, i) {
        var sep = i > 0 ? '<span class="ork-bc-sep">\u203A</span>' : '';
        if (c.active) {
          return sep + '<span class="ork-bc-item ork-bc-active" aria-current="page">' + c.label + '</span>';
        }
        return sep + '<a class="ork-bc-item" href="' + c.href + '">' + c.label + '</a>';
      }).join('');
      container.innerHTML = html;
    }
  };

  // ─── Share Utilities ───────────────────────────────────────────────────────
  window.orkShare = {
    twitter: function(text, url) {
      var tweetUrl = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
      window.open(tweetUrl, '_blank', 'width=550,height=420');
    },
    linkedin: function(url) {
      var shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
      window.open(shareUrl, '_blank', 'width=550,height=420');
    },
    copyUrl: function(url, callback) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          if (callback) callback(true);
        }).catch(function() {
          if (callback) callback(false);
        });
      } else {
        // Fallback for file:// protocol
        var input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        try {
          document.execCommand('copy');
          if (callback) callback(true);
        } catch (e) {
          if (callback) callback(false);
        }
        document.body.removeChild(input);
      }
    },
    getCompShareText: function(comp) {
      var text = 'Check out "' + comp.id + '"';
      if (comp.hook) {
        text += ' - ' + comp.hook;
      }
      text += ' | OrchestKit Demo';
      return text;
    },
    renderButtons: function(containerId, comp, url) {
      var container = document.getElementById(containerId);
      if (!container) return;
      var shareText = this.getCompShareText(comp);
      container.innerHTML =
        '<div class="ork-share-bar">' +
          '<button class="ork-share-btn ork-share-twitter" onclick="orkShare.twitter(\'' + shareText.replace(/'/g, "\\'") + '\', \'' + url + '\')" title="Share on Twitter" aria-label="Share on Twitter">' +
            '<span class="ork-share-icon" aria-hidden="true">\uD83D\uDC26</span> Tweet' +
          '</button>' +
          '<button class="ork-share-btn ork-share-linkedin" onclick="orkShare.linkedin(\'' + url + '\')" title="Share on LinkedIn" aria-label="Share on LinkedIn">' +
            '<span class="ork-share-icon" aria-hidden="true">in</span> LinkedIn' +
          '</button>' +
          '<button class="ork-share-btn ork-share-copy" id="shareCopyBtn" onclick="orkShare.copyUrl(\'' + url + '\', function(ok) { var btn = document.getElementById(\'shareCopyBtn\'); btn.innerHTML = ok ? \'<span class=ork-share-icon aria-hidden=true>\u2713</span> Copied!\' : \'Failed\'; setTimeout(function() { btn.innerHTML = \'<span class=ork-share-icon aria-hidden=true>\uD83D\uDCCB</span> Copy Link\'; }, 1500); })" title="Copy link" aria-label="Copy link to clipboard">' +
            '<span class="ork-share-icon" aria-hidden="true">\uD83D\uDCCB</span> Copy Link' +
          '</button>' +
        '</div>';
    }
  };

  // ─── Navigation Bar ─────────────────────────────────────────────────────────
  if (!data) {
    console.warn('[ork-nav] ORCHESTKIT_DATA not found. Load data.js before nav.js.');
    return;
  }

  // Detect active page from current filename
  var path = window.location.pathname;
  var filename = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

  // Load nav.css if not already present
  if (!document.querySelector('link[href*="nav.css"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'nav.css';
    document.head.appendChild(link);
  }

  // Build nav HTML
  var nav = document.createElement('nav');
  nav.className = 'ork-nav-bar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'OrchestKit Playground Navigation');

  var linksHTML = data.pages.map(function(page) {
    var isActive = filename === page.href || (filename === '' && page.href === 'index.html');
    return '<a class="ork-nav-link' + (isActive ? ' ork-nav-active' : '') + '" href="' + page.href + '" title="' + page.description + '">' +
      '<span class="ork-nav-link-icon">' + page.icon + '</span>' +
      '<span class="ork-nav-link-label">' + page.label + '</span>' +
    '</a>';
  }).join('');

  nav.innerHTML =
    '<div class="ork-nav-left">' +
      '<a class="ork-nav-logo" href="index.html">' +
        '<div class="ork-nav-logo-icon">OK</div>' +
        '<span class="ork-nav-logo-text">OrchestKit</span>' +
      '</a>' +
      '<div class="ork-nav-links">' + linksHTML + '</div>' +
    '</div>' +
    '<div class="ork-nav-right">' +
      '<span class="ork-nav-version">v' + data.version + '</span>' +
    '</div>';

  // Inject into DOM
  document.body.insertBefore(nav, document.body.firstChild);
  document.body.classList.add('ork-nav-enabled');
})();
