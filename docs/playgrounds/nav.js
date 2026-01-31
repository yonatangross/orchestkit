/**
 * OrchestKit Playground Navigation
 * Injects a fixed top navigation bar into any playground page.
 * Requires data.js to be loaded first (window.ORCHESTKIT_DATA).
 */
(function() {
  'use strict';

  var data = window.ORCHESTKIT_DATA;
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
