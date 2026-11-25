// Shared base of the OrchestKit MCP App views: one custom element per view, a
// shadow root, and a `host` object the surface supplies. An element makes no
// request and never talks to the parent frame; mount() is the MCP Apps surface
// and the only code here that does. A view ships as one string, so this file is
// inlined by scripts/generate-mcp-ui-tokens.mjs and uses no import.
(function (g) {
  "use strict";
  var SVG = "http://www.w3.org/2000/svg";
  var sheet = "";
  // lucide (ISC license), the icon set the site uses.
  var ICONS = {
    terminal: [["path", { d: "M12 19h8" }], ["path", { d: "m4 17 6-6-6-6" }]],
    copy: [["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }], ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }]],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    minus: [["path", { d: "M5 12h14" }]]
  };

  function append(node, child) {
    if (Array.isArray(child)) child.forEach(function (c) { append(node, c); });
    else if (child !== null && child !== undefined && child !== false) node.append(child);
  }

  // Text only ever enters the page as a text node or textContent.
  function h(tag, attrs) {
    var node = document.createElement(tag), key, value, i;
    for (key in attrs || {}) {
      value = attrs[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : String(value));
    }
    for (i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function icon(name) {
    var svg = document.createElementNS(SVG, "svg");
    var attrs = { viewBox: "0 0 24 24", "class": "ic", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" };
    Object.keys(attrs).forEach(function (k) { svg.setAttribute(k, attrs[k]); });
    ICONS[name].forEach(function (part) {
      var shape = document.createElementNS(SVG, part[0]);
      Object.keys(part[1]).forEach(function (k) { shape.setAttribute(k, part[1][k]); });
      svg.appendChild(shape);
    });
    return svg;
  }

  // Only https links to the docs site itself. Anything else is not a link.
  function siteUrl(value) {
    if (typeof value !== "string") return null;
    try {
      var url = new URL(value);
      return url.protocol === "https:" && url.hostname === "orchestkit.dev" && !url.port && !url.username && !url.password ? url.href : null;
    } catch (e) { return null; }
  }

  function text(value) { return typeof value === "string" ? value : ""; }

  function copy(value, status) {
    function done(ok) {
      status.textContent = "";
      if (ok) append(status, [icon("check"), " Copied to the clipboard."]);
      else status.textContent = "Copy was blocked here. Select the command and press Ctrl+C.";
    }
    function fallback() {
      var area = document.createElement("textarea");
      area.value = value; area.setAttribute("readonly", "");
      area.style.position = "fixed"; area.style.opacity = "0";
      document.body.appendChild(area); area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(function () { done(true); }, fallback);
    else fallback();
  }

  // One command per line. Each space-separated word is a no-wrap unit, so a long
  // command wraps between words and never inside one, and a wrapped line is
  // indented so it reads as the same command.
  function commandBlock(lines, prompt) {
    return h("pre", { tabindex: "0" }, lines.map(function (line) {
      var row = h("span", { "class": "ln", "data-p": prompt ? "1" : null });
      line.split(" ").forEach(function (word, i) { append(row, [i ? " " : null, h("span", { "class": "t", text: word })]); });
      return row;
    }));
  }

  function status() { return h("p", { "class": "status", role: "status" }); }

  class View extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._data = undefined;
      this.host = null;
    }
    connectedCallback() { this.paint(); }
    get data() { return this._data; }
    set data(value) { this._data = value; this.paint(); }
    setTheme(theme) { if (theme === "light" || theme === "dark") this.setAttribute("data-theme", theme); }
    // What a screen reader hears once when data arrives. "" says nothing.
    summary() { return ""; }
    resized() { if (this.host && this.host.resized) this.host.resized(); }
    paint() {
      if (!this.isConnected) return;
      if (!this._app) {
        this._app = h("div", { "class": "app" });
        this._live = h("div", { "class": "sr", role: "status", "aria-live": "polite" });
        this.shadowRoot.replaceChildren(h("style", { text: sheet }), this._app, this._live);
      }
      this._app.textContent = "";
      append(this._app, this.render(this._data));
      var said = this.summary(this._data);
      if (this._live.textContent !== said) this._live.textContent = said;
      this.resized();
    }
    waiting(what) { return h("p", { "class": "muted", text: "Waiting for " + what + " from the host…" }); }
    // A real link. A host that opens links for the view is asked to; otherwise
    // the browser follows it.
    link(url, label, cls) {
      var safe = siteUrl(url), self = this;
      if (!safe) return null;
      return h("a", { "class": cls || "link", href: safe, target: "_blank", rel: "noopener noreferrer", text: label, onclick: function (e) {
        if (self.host && self.host.openLink && self.host.openLink(safe)) e.preventDefault();
      } });
    }
    // Ask the host for a follow-up message and say what to do if nothing happens.
    ask(prompt, said, byHand) {
      said.textContent = this.host && this.host.message && this.host.message(prompt) ? "Asked. If nothing happens, " + byHand.charAt(0).toLowerCase() + byHand.slice(1) : byHand;
    }
    // The site's install card. The clipboard gets exactly the lines on display,
    // joined to one (issue 5337).
    installCard(title, where, lines, prompt, copyLabel) {
      var said = status(), value = lines.join(" && ");
      return [h("div", { "class": "install" },
        h("div", { "class": "install-head" },
          h("span", { "class": "install-who" }, icon("terminal"), h("span", null, h("b", { text: title }), h("span", { text: where }))),
          h("button", { "class": "copy", type: "button", "data-copy": value, "aria-label": copyLabel, onclick: function () { copy(value, said); } }, icon("copy"), "Copy")),
        commandBlock(lines, prompt)), said];
    }
  }

  // The MCP App surface: JSON-RPC over postMessage with the frame that embedded
  // the view, plus the ChatGPT window.openai object where there is one.
  function mount(tag) {
    var el = document.createElement(tag), hostOrigin = null, seq = 1, capabilities = {};
    function embedded() { return !!g.parent && g.parent !== g; }
    // Only the embedding frame may speak to the view. A web host speaks through a
    // sandbox proxy on its own origin (MCP Apps spec, "Sandbox proxy"), so no
    // fixed origin list can name the sender. The first recognised host message
    // pins its origin: later messages must come from it, and sends go to it.
    function fromHost(e) { return embedded() && e.source === g.parent && (hostOrigin === null || e.origin === hostOrigin); }
    // Only the ui/initialize handshake goes out before the host's origin is
    // known. An opaque origin arrives as "null", addressable only with "*".
    function send(message) {
      if (!embedded()) return false;
      var to = hostOrigin;
      if (to === null) { if (message.method !== "ui/initialize") return false; to = "*"; }
      else if (to === "null") to = "*";
      g.parent.postMessage(message, to); return true;
    }
    function request(method, params) { return send({ jsonrpc: "2.0", id: ++seq, method: method, params: params }); }
    function context(c) {
      if (!c || typeof c !== "object") return;
      el.setTheme(c.theme);
      var vars = c.styles && c.styles.variables;
      // The two font families only: the view keeps the site's own colors.
      ["--font-sans", "--font-mono"].forEach(function (k) { if (vars && typeof vars[k] === "string") el.style.setProperty(k, vars[k]); });
    }
    // What a host message does, or null for anything the view does not know.
    function receive(d) {
      if (!d || typeof d !== "object") return null;
      if (d.type === "ui-lifecycle-iframe-render-data") return function () { el.data = d.payload && d.payload.toolOutput; };
      if (d.jsonrpc !== "2.0") return null;
      if (d.method === "ui/notifications/tool-result") return function () { el.data = d.params && d.params.structuredContent; };
      if (d.method === "ui/notifications/host-context-changed") return function () { context(d.params); };
      if ((d.method === "ping" || d.method === "ui/resource-teardown") && d.id !== undefined) return function () { send({ jsonrpc: "2.0", id: d.id, result: {} }); };
      if (d.method === undefined && d.id === 1 && d.result) return function () {
        capabilities = d.result.hostCapabilities || {};
        context(d.result.hostContext);
        send({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
      };
      return null;
    }
    // The element's own box: a document is never shorter than its frame, so
    // reporting the document could grow the frame but never shrink it.
    function reportSize() { send({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: { width: Math.ceil(el.offsetWidth), height: Math.ceil(el.offsetHeight) } }); }
    el.host = {
      openLink: function (url) {
        if (g.openai && typeof g.openai.openExternal === "function") { g.openai.openExternal({ href: url }); return true; }
        return !!capabilities.openLinks && request("ui/open-link", { url: url });
      },
      message: function (value) {
        if (g.openai && typeof g.openai.sendFollowUpMessage === "function") { g.openai.sendFollowUpMessage({ prompt: value }); return true; }
        return request("ui/message", { role: "user", content: { type: "text", text: value } });
      },
      resized: reportSize
    };
    function fromOpenai() {
      if (!g.openai) return;
      el.setTheme(g.openai.theme);
      if (g.openai.toolOutput) el.data = g.openai.toolOutput;
    }
    g.addEventListener("message", function (e) {
      if (!fromHost(e)) return;
      var act = receive(e.data);
      if (!act) return;
      hostOrigin = e.origin;
      act();
      reportSize();
    });
    g.addEventListener("openai:set_globals", fromOpenai);
    document.body.appendChild(el);
    fromOpenai();
    if (g.ResizeObserver) new g.ResizeObserver(reportSize).observe(el);
    send({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: { appInfo: { name: tag, version: "1.0.0" }, appCapabilities: {}, protocolVersion: "2026-01-26" } });
    return el;
  }

  g.OrkMcp = {
    h: h, icon: icon, text: text, siteUrl: siteUrl, status: status, View: View, mount: mount,
    styles: function (css) { sheet = css; },
    define: function (tag, view) { if (!customElements.get(tag)) customElements.define(tag, view); }
  };
})(window);
