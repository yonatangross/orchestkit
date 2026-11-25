// ui://orchestkit/search-results. Data: { results: [{ title, url, content }] }.
(function (ui) {
  "use strict";
  var h = ui.h;
  var SHOWN = 5;
  function hits(d) {
    return d && Array.isArray(d.results) ? d.results.filter(function (r) { return r && typeof r.title === "string"; }) : null;
  }
  ui.define("ork-search-results", class extends ui.View {
    summary(d) { var all = hits(d); return all ? all.length + (all.length === 1 ? " page found" : " pages found") : ""; }
    render(d) {
      var self = this, all = hits(d);
      if (!all) return this.waiting("results");
      var eyebrow = h("p", { "class": "eyebrow", text: "Docs search" });
      if (!all.length) return [eyebrow, h("p", { "class": "muted", text: "No matching documentation. Try a shorter query." })];
      var rows = all.slice(0, SHOWN);
      return [eyebrow,
        h("p", { "class": "stat" },
          h("span", null, all.length > rows.length ? "Top " + rows.length + " of " : "", h("b", { text: String(all.length) }), all.length === 1 ? " page" : " pages"),
          h("span", { text: "orchestkit.dev/docs" })),
        h("ul", { "class": "list", role: "list" }, rows.map(function (r) {
          var safe = ui.siteUrl(r.url);
          return h("li", null,
            self.link(r.url, r.title, "link row-link") || h("span", { text: r.title }),
            h("span", { "class": "snippet", text: ui.text(r.content) }),
            safe ? h("span", { "class": "path", text: new URL(safe).pathname }) : null);
        }))];
    }
  });
})(window.OrkMcp);
